import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the service-role client: only the calls sendNotification makes.
interface Row {
  id: string;
  status: string;
  dedupe_key: string;
  [k: string]: unknown;
}
const state = {
  email: "owner@realmail.com" as string | null,
  rows: [] as Row[],
  updates: [] as { id: unknown; payload: Record<string, unknown> }[],
};

class FakeQuery {
  private action: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> = {};
  private filters: [string, unknown][] = [];
  constructor(private readonly table: string) {}
  select() {
    return this;
  }
  insert(payload: Record<string, unknown>) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Record<string, unknown>) {
    this.action = "update";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push([col, val]);
    return this;
  }
  single() {
    return Promise.resolve(this.exec());
  }
  maybeSingle() {
    return Promise.resolve(this.exec());
  }
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T) {
    return Promise.resolve(this.exec()).then(resolve);
  }
  private match(row: Row) {
    return this.filters.every(([c, v]) => row[c] === v);
  }
  private exec(): { data: unknown; error: unknown } {
    if (this.table === "profiles") return { data: state.email === null ? null : { email: state.email }, error: null };
    if (this.table === "notification_templates") return { data: null, error: null };
    if (this.table !== "notifications") throw new Error(`unexpected table ${this.table}`);
    if (this.action === "insert") {
      if (state.rows.some((r) => r.dedupe_key === this.payload.dedupe_key)) return { data: null, error: { code: "23505", message: "dup" } };
      const row = { ...this.payload, id: `n${state.rows.length + 1}` } as Row;
      state.rows.push(row);
      return { data: { id: row.id }, error: null };
    }
    const hit = state.rows.find((r) => this.match(r)) ?? null;
    if (this.action === "update") {
      if (!hit) return { data: null, error: null };
      Object.assign(hit, this.payload);
      state.updates.push({ id: hit.id, payload: this.payload });
      return { data: { id: hit.id }, error: null };
    }
    return { data: hit, error: null };
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => new FakeQuery(table) }),
}));

const provider = { name: "outbox" as "outbox" | "resend", send: vi.fn() };
vi.mock("@/lib/email/provider", () => ({ getEmailProvider: () => provider }));

const { sendNotification } = await import("@/lib/notifications/send");

const input = {
  userId: "user-1",
  templateKey: "filing_submitted",
  dedupeKey: "filing_submitted:f1:PA-1",
  vars: { company_name: "Acme LLC", state_name: "Pennsylvania", filing_title: "Annual Report", confirmation_number: "PA-1" },
  ctaPath: "/dashboard/filings/f1",
  filingId: "f1",
};

beforeEach(() => {
  state.email = "owner@realmail.com";
  state.rows = [];
  state.updates = [];
  provider.name = "outbox";
  provider.send.mockReset();
  provider.send.mockResolvedValue({ id: "msg_1" });
});

describe("sendNotification recipient guard", () => {
  it("suppresses a reserved test address without calling the provider", async () => {
    state.email = "e2e.abc.123@e2e.filewell.test";
    const r = await sendNotification(input);
    expect(r.status).toBe("suppressed");
    expect(provider.send).not.toHaveBeenCalled();
    expect(state.rows[0]).toMatchObject({ status: "suppressed", error: "reserved test address", to_address: "e2e.abc.123@e2e.filewell.test" });
    // The rendered message is still recorded for staff.
    expect(state.rows[0].subject).toContain("Acme LLC");
  });

  it.each(["a@example.com", "a@x.example", "a@y.invalid", "a@z.localhost", "a@q.test"])("suppresses %s", async (address) => {
    state.email = address;
    expect((await sendNotification(input)).status).toBe("suppressed");
    expect(provider.send).not.toHaveBeenCalled();
  });

  it("suppresses when the caller passes a suppress reason", async () => {
    const r = await sendNotification({ ...input, suppressReason: "test-mode payment (no real charge)" });
    expect(r.status).toBe("suppressed");
    expect(provider.send).not.toHaveBeenCalled();
    expect(state.rows[0]).toMatchObject({ status: "suppressed", error: "test-mode payment (no real charge)" });
  });

  it("sends to a real address and records the provider", async () => {
    provider.name = "resend";
    const r = await sendNotification(input);
    expect(r.status).toBe("sent");
    expect(provider.send).toHaveBeenCalledTimes(1);
    expect(provider.send.mock.calls[0][0]).toMatchObject({ to: "owner@realmail.com", idempotencyKey: input.dedupeKey });
    expect(state.rows[0]).toMatchObject({ status: "sent", provider: "resend", provider_message_id: "msg_1" });
  });
});

describe("sendNotification failures", () => {
  it("records a visible failure with the provider's reason (e.g. delivery not configured)", async () => {
    provider.name = "resend";
    provider.send.mockRejectedValueOnce(new Error("Email delivery is not configured: RESEND_API_KEY is missing"));
    const r = await sendNotification(input);
    expect(r.status).toBe("failed");
    expect(state.rows[0]).toMatchObject({ status: "failed", provider: "resend", error: "Email delivery is not configured: RESEND_API_KEY is missing" });
  });

  it("retries a row whose earlier attempt failed, reusing the same row and idempotency key", async () => {
    provider.send.mockRejectedValueOnce(new Error("Email send failed: rate_limit_exceeded"));
    expect((await sendNotification(input)).status).toBe("failed");
    const r = await sendNotification(input);
    expect(r).toEqual({ status: "sent", notificationId: "n1" });
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ status: "sent", error: null });
    expect(provider.send).toHaveBeenCalledTimes(2);
    expect(provider.send.mock.calls[1][0].idempotencyKey).toBe(input.dedupeKey);
  });

  it("does not resend a row that was already sent or suppressed", async () => {
    await sendNotification(input);
    expect(await sendNotification(input)).toEqual({ status: "duplicate", notificationId: "n1" });
    state.email = "a@example.com";
    await sendNotification({ ...input, dedupeKey: "other" });
    expect((await sendNotification({ ...input, dedupeKey: "other" })).status).toBe("duplicate");
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
});
