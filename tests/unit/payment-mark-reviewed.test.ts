import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mark reviewed for a payment flagged for review. The real server action, requireAdmin,
 * audit() and the daily staff alert run against an in-memory stand-in for Supabase (the
 * signed-in user comes from the session stand-in, staff roles from staff_members, as in
 * production). Nothing is sent anywhere.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  sent: [] as { to: string; subject: string; text: string }[],
  nextId: 1,
  /** Writes (insert or update) to this table fail, as a dropped connection would. */
  failingWrite: null as string | null,
  userId: null as string | null,
  revalidated: [] as string[],
}));

function query(table: string) {
  const rows = () => (h.tables[table] ??= []);
  const state = { op: "select" as "select" | "insert" | "update", payload: null as Row | null, filters: [] as ((r: Row) => boolean)[], returning: false };
  const matching = () => rows().filter((r) => state.filters.every((f) => f(r)));
  const resolve = (single: boolean) => {
    if (state.op !== "select" && table === h.failingWrite) return { data: null, error: { code: "08006", message: "connection failure" } };
    if (state.op === "insert") {
      const row = { id: `${table}-${h.nextId++}`, ...state.payload } as Row;
      if (table === "notifications" && rows().some((r) => r.dedupe_key === row.dedupe_key)) {
        return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
      }
      rows().push(row);
      return { data: row, error: null };
    }
    if (state.op === "update") {
      const hit = matching();
      for (const r of hit) Object.assign(r, state.payload);
      return { data: state.returning ? (hit[0] ?? null) : null, error: null };
    }
    const hit = matching();
    return { data: single ? (hit[0] ?? null) : hit, error: null };
  };
  const b = {
    select: () => ((state.returning = state.op !== "select"), b),
    insert: (payload: Row) => ((state.op = "insert"), (state.payload = payload), b),
    update: (payload: Row) => ((state.op = "update"), (state.payload = payload), b),
    eq: (col: string, val: unknown) => (state.filters.push((r) => r[col] === val), b),
    in: (col: string, vals: unknown[]) => (state.filters.push((r) => vals.includes(r[col])), b),
    order: () => b,
    limit: () => b,
    overrideTypes: () => b,
    maybeSingle: async () => resolve(true),
    single: async () => resolve(true),
    then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(resolve(false)).then(ok, fail),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: query,
    auth: {
      getUser: async () =>
        h.userId
          ? { data: { user: { id: h.userId, email: `${h.userId}@unit-test-only.com`, email_confirmed_at: "2026-10-01T00:00:00Z" } }, error: null }
          : { data: { user: null }, error: null },
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void h.revalidated.push(p) }));
vi.mock("@/lib/email/provider", () => ({
  getEmailProvider: () => ({
    name: "outbox",
    send: async (m: { to: string; subject: string; text: string }) => {
      h.sent.push(m);
      return { id: `msg-${h.sent.length}` };
    },
  }),
}));
vi.mock("@/lib/filings/context", () => ({ loadFilingContext: vi.fn() }));

const { markPaymentReviewedAction } = await import("@/app/admin/payments/actions");
const { alertStaffOfPaymentsNeedingReview } = await import("@/lib/payments/review-alerts");

const PAYMENT_ID = "6f1c2a9e-3b7d-4c55-9a10-2e8f4b6d0c11";
const REASON = "duplicate payment for an order that was already paid - refund it";

function flaggedPayment(over: Row = {}): Row {
  return {
    id: PAYMENT_ID,
    order_id: "order-1",
    user_id: "customer-1",
    mode: "live",
    status: "succeeded",
    amount_cents: 5600,
    amount_refunded_cents: 0,
    requires_review: true,
    review_reason: REASON,
    updated_at: "2026-10-28T01:00:00Z",
    ...over,
  };
}

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const valid = { paymentId: PAYMENT_ID, note: "Refunded the second charge in Stripe; first charge kept.", confirm: "yes" };

beforeEach(() => {
  h.sent = [];
  h.nextId = 1;
  h.failingWrite = null;
  h.userId = "admin-1";
  h.revalidated = [];
  h.tables = {
    payments: [flaggedPayment()],
    audit_logs: [],
    filings: [{ id: "filing-1", order_id: "order-1", business_id: "biz-1", businesses: { legal_name: "Example Partners LP" } }],
    staff_members: [
      { user_id: "admin-1", role: "admin", display_name: "Admin", active: true },
      { user_id: "operator-1", role: "operator", display_name: "Operator", active: true },
    ],
    profiles: [
      { id: "admin-1", email: "admin@unit-test-only.com" },
      { id: "operator-1", email: "operator@unit-test-only.com" },
    ],
    notification_templates: [],
    notifications: [],
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("markPaymentReviewedAction", () => {
  it("an operator cannot call it: 404, nothing changes", async () => {
    h.userId = "operator-1";
    await expect(markPaymentReviewedAction(null, form(valid))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
    expect(h.tables.payments[0].requires_review).toBe(true);
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("a customer (signed in, not staff) cannot call it: 404, nothing changes", async () => {
    h.userId = "customer-1";
    await expect(markPaymentReviewedAction(null, form(valid))).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
    expect(h.tables.payments[0].requires_review).toBe(true);
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("refuses an empty note", async () => {
    const result = await markPaymentReviewedAction(null, form({ ...valid, note: "   " }));
    expect(result).toEqual({ ok: false, error: "Say what you checked." });
    expect(h.tables.payments[0].requires_review).toBe(true);
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("refuses a note over 500 characters and a missing confirmation", async () => {
    expect(await markPaymentReviewedAction(null, form({ ...valid, note: "x".repeat(501) }))).toMatchObject({ ok: false });
    expect(await markPaymentReviewedAction(null, form({ paymentId: valid.paymentId, note: valid.note }))).toMatchObject({ ok: false });
    expect(h.tables.payments[0].requires_review).toBe(true);
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("an admin clears the flag: only requires_review changes, one audit row with the note", async () => {
    const before = { ...h.tables.payments[0] };
    const result = await markPaymentReviewedAction(null, form(valid));
    expect(result).toMatchObject({ ok: true });
    expect(h.tables.payments[0]).toEqual({ ...before, requires_review: false });
    expect(h.tables.audit_logs).toEqual([
      expect.objectContaining({
        actor_user_id: "admin-1",
        actor_type: "staff",
        action: "payment.review_cleared",
        entity_type: "payment",
        entity_id: PAYMENT_ID,
        filing_id: "filing-1",
        before: { requires_review: true, review_reason: REASON },
        after: { requires_review: false, review_reason: REASON },
        metadata: { note: valid.note, order_id: "order-1" },
      }),
    ]);
    expect(h.revalidated).toEqual(expect.arrayContaining(["/admin/payments", "/admin", "/admin/filings/filing-1"]));
  });

  it("clearing an already cleared payment changes nothing and writes no audit row", async () => {
    h.tables.payments = [flaggedPayment({ requires_review: false })];
    const result = await markPaymentReviewedAction(null, form(valid));
    expect(result).toEqual({ ok: true, message: "Already reviewed. Nothing changed.", details: undefined });
    expect(h.tables.payments[0].requires_review).toBe(false);
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("an unknown payment is refused", async () => {
    const result = await markPaymentReviewedAction(null, form({ ...valid, paymentId: "0b5c8d2e-1a4f-4e6b-8c3d-9f7a2b1e0d55" }));
    expect(result).toEqual({ ok: false, error: "Payment not found." });
    expect(h.tables.audit_logs).toHaveLength(0);
  });

  it("if the audit write fails, the flag stays and the action reports an error", async () => {
    h.failingWrite = "audit_logs";
    const result = await markPaymentReviewedAction(null, form(valid));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Audit write failed") });
    expect(h.tables.payments[0].requires_review).toBe(true);
  });

  it("if clearing the flag fails after the audit row, it reports an error, never success", async () => {
    h.failingWrite = "payments";
    const result = await markPaymentReviewedAction(null, form(valid));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("the flag was not cleared") });
    expect(h.tables.payments[0].requires_review).toBe(true);
  });

  it("after clearing, the daily staff alert finds no cases and sends nothing", async () => {
    expect(await alertStaffOfPaymentsNeedingReview(new Date("2026-10-28T13:00:00Z"))).toMatchObject({ cases: 1 });
    h.sent = [];
    await markPaymentReviewedAction(null, form(valid));
    const next = await alertStaffOfPaymentsNeedingReview(new Date("2026-10-29T13:00:00Z"));
    expect(next).toEqual({ cases: 0, sent: 0, duplicate: 0, failed: 0, suppressed: 0 });
    expect(h.sent).toHaveLength(0);
  });
});
