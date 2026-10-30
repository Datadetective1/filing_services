import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recording a partner alert: matched by the partner company ID, recorded once, staff always
 * told, the customer told only when exactly one live subscription matches.
 */

type Call = { table: string; op: string; payload?: unknown; opts?: unknown; filters: [string, string, unknown][] };
const calls: Call[] = [];
let handler: (c: Call) => { data: unknown; error: unknown } = () => ({ data: null, error: null });

function builder(table: string) {
  const c: Call = { table, op: "select", filters: [] };
  const b: Record<string, unknown> = {};
  const chain = (name: string) => (col: string, val: unknown) => {
    c.filters.push([name, col, val]);
    return b;
  };
  Object.assign(b, {
    select: () => b,
    upsert: (payload: unknown, opts: unknown) => Object.assign(c, { op: "upsert", payload, opts }) && b,
    update: (payload: unknown) => Object.assign(c, { op: "update", payload }) && b,
    eq: chain("eq"),
    in: chain("in"),
    is: chain("is"),
    lte: chain("lte"),
    order: () => b,
    limit: () => b,
    maybeSingle: () => {
      calls.push(c);
      return Promise.resolve(handler(c));
    },
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      calls.push(c);
      return Promise.resolve(handler(c)).then(res, rej);
    },
  });
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => builder(t) }) }));
const audit = vi.fn();
vi.mock("@/lib/audit", () => ({ audit: (...a: unknown[]) => audit(...a) }));
const sendNotification = vi.fn();
vi.mock("@/lib/notifications/send", () => ({ sendNotification: (...a: unknown[]) => sendNotification(...a) }));
const notifyStaff = vi.fn();
vi.mock("@/lib/notifications/staff", () => ({ notifyStaff: (...a: unknown[]) => notifyStaff(...a) }));

const { recordProviderDocumentAlert, remindOpenAlerts, recordProviderCompanyId } = await import("@/lib/registered-agent/document-events");

const SUB = { id: "sub-1", user_id: "user-1", business_id: "biz-1", state_code: "TX", service_status: "active" };

function world(opts: { subs?: unknown[]; inserted?: boolean; legalName?: string } = {}) {
  handler = (c) => {
    if (c.table === "ra_subscriptions" && c.op === "select") return { data: opts.subs ?? [], error: null };
    if (c.table === "provider_document_events" && c.op === "upsert") return { data: opts.inserted === false ? [] : [{ id: "evt-1" }], error: null };
    if (c.table === "businesses") return { data: { legal_name: opts.legalName ?? "Acme LLC" }, error: null };
    return { data: null, error: null };
  };
}

beforeEach(() => {
  calls.length = 0;
  audit.mockReset();
  notifyStaff.mockReset();
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ status: "sent", notificationId: "n1" });
});

const EVENT = { documentId: "D-1", companyId: "C-9", companyName: "Acme Partner Name" };

describe("recordProviderDocumentAlert", () => {
  it("matches one subscription by company ID, records it once, tells staff and the customer", async () => {
    world({ subs: [SUB] });
    expect(await recordProviderDocumentAlert(EVENT)).toBe("recorded");

    const lookup = calls.find((c) => c.table === "ra_subscriptions")!;
    expect(lookup.filters).toEqual([
      ["eq", "provider", "registered_agents_inc"],
      ["eq", "provider_account_ref", "C-9"],
    ]);
    const upsert = calls.find((c) => c.op === "upsert")!;
    expect(upsert.payload).toMatchObject({
      provider_document_id: "D-1",
      provider_company_id: "C-9",
      match_status: "matched",
      ra_subscription_id: "sub-1",
      user_id: "user-1",
      business_id: "biz-1",
    });
    expect(upsert.opts).toEqual({ onConflict: "provider,provider_document_id", ignoreDuplicates: true });

    expect(notifyStaff).toHaveBeenCalledTimes(1);
    expect(notifyStaff.mock.calls[0][0]).toMatchObject({
      templateKey: "staff_ra_partner_document",
      dedupeKey: "ra_partner_document:evt-1",
      ctaPath: "/admin/registered-agent/sub-1",
      vars: { company_name: "Acme LLC", state_name: "Texas", provider_document_id: "D-1", provider_company_id: "C-9" },
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      templateKey: "ra_document_arriving",
      dedupeKey: "ra_document_arriving:evt-1",
      ctaPath: "/dashboard/services/sub-1",
    });
    expect(calls.some((c) => c.op === "update" && (c.payload as Record<string, unknown>).customer_notified_at)).toBe(true);
    expect(audit.mock.calls[0][0]).toMatchObject({ actorType: "webhook", action: "provider_document_event.received", entityId: "evt-1" });
  });

  it("does nothing more for a replayed alert", async () => {
    world({ subs: [SUB], inserted: false });
    expect(await recordProviderDocumentAlert(EVENT)).toBe("duplicate");
    expect(notifyStaff).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("records an unknown company as unmatched and tells staff only", async () => {
    world({ subs: [] });
    await recordProviderDocumentAlert(EVENT);
    expect(calls.find((c) => c.op === "upsert")!.payload).toMatchObject({ match_status: "unmatched", ra_subscription_id: null, user_id: null });
    expect(notifyStaff.mock.calls[0][0]).toMatchObject({ ctaPath: "/admin/registered-agent", vars: { company_name: "Acme Partner Name" } });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("never picks a customer when two subscriptions share the company ID", async () => {
    world({ subs: [SUB, { ...SUB, id: "sub-2", user_id: "user-2" }] });
    await recordProviderDocumentAlert(EVENT);
    expect(calls.find((c) => c.op === "upsert")!.payload).toMatchObject({ match_status: "ambiguous", ra_subscription_id: null });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(notifyStaff).toHaveBeenCalledTimes(1);
  });

  it("skips the lookup when the alert has no company ID", async () => {
    world();
    await recordProviderDocumentAlert({ documentId: "D-2", companyId: null, companyName: null });
    expect(calls.some((c) => c.table === "ra_subscriptions")).toBe(false);
    expect(notifyStaff.mock.calls[0][0].vars).toMatchObject({ provider_company_id: "(none sent)", company_name: "an unknown company" });
  });

  it("doesn't email a customer whose service has ended", async () => {
    world({ subs: [{ ...SUB, service_status: "ended" }] });
    await recordProviderDocumentAlert(EVENT);
    expect(notifyStaff).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("keeps the alert when the customer email fails", async () => {
    world({ subs: [SUB] });
    sendNotification.mockRejectedValue(new Error("mail down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await recordProviderDocumentAlert(EVENT)).toBe("recorded");
  });

  it("throws (so the partner retries) when the record can't be written", async () => {
    handler = (c) => (c.op === "upsert" ? { data: null, error: { message: "db down" } } : { data: [], error: null });
    await expect(recordProviderDocumentAlert(EVENT)).rejects.toThrow("alert record failed");
    expect(notifyStaff).not.toHaveBeenCalled();
  });
});

describe("remindOpenAlerts", () => {
  it("reminds staff once per alert still open after four hours", async () => {
    const now = new Date("2026-10-30T12:00:00Z");
    handler = (c) =>
      c.table === "provider_document_events" && c.op === "select"
        ? { data: [{ id: "evt-1", provider_document_id: "D-1", provider_company_id: "C-9", provider_company_name: "Acme", ra_subscription_id: "sub-1", business_id: null }], error: null }
        : { data: null, error: null };
    expect(await remindOpenAlerts(now)).toBe(1);
    const scan = calls.find((c) => c.table === "provider_document_events" && c.op === "select")!;
    expect(scan.filters).toContainEqual(["lte", "received_at", "2026-10-30T08:00:00.000Z"]);
    expect(scan.filters).toContainEqual(["is", "reminder_sent_at", null]);
    expect(notifyStaff.mock.calls[0][0]).toMatchObject({ dedupeKey: "ra_partner_document_reminder:evt-1", ctaPath: "/admin/registered-agent/sub-1" });
    expect(calls.some((c) => c.op === "update" && (c.payload as Record<string, unknown>).reminder_sent_at)).toBe(true);
  });
});

describe("recordProviderCompanyId", () => {
  const staff = { id: "staff-1", role: "operator" } as never;

  it("refuses an ID that isn't plain", async () => {
    world();
    await expect(recordProviderCompanyId(staff, "sub-1", "a b")).rejects.toThrow("exactly as the partner portal shows it");
  });

  it("saves the ID and links earlier unmatched alerts for that company", async () => {
    handler = (c) => {
      if (c.table === "ra_subscriptions" && c.op === "select") return { data: { ...SUB, provider: "registered_agents_inc" }, error: null };
      if (c.table === "provider_document_events" && c.op === "update") return { data: [{ id: "evt-1" }], error: null };
      return { data: null, error: null };
    };
    expect(await recordProviderCompanyId(staff, "sub-1", " C-9 ")).toBe(1);
    const link = calls.find((c) => c.table === "provider_document_events" && c.op === "update")!;
    expect(link.payload).toEqual({ match_status: "matched", ra_subscription_id: "sub-1", user_id: "user-1", business_id: "biz-1" });
    expect(link.filters).toContainEqual(["eq", "provider_company_id", "C-9"]);
    expect(link.filters).toContainEqual(["is", "handled_at", null]);
  });

  it("explains a company ID already on another subscription", async () => {
    handler = (c) => {
      if (c.table === "ra_subscriptions" && c.op === "select") return { data: { ...SUB, provider: "registered_agents_inc" }, error: null };
      if (c.table === "ra_subscriptions" && c.op === "update") return { data: null, error: { code: "23505", message: "duplicate key" } };
      return { data: null, error: null };
    };
    await expect(recordProviderCompanyId(staff, "sub-1", "C-9")).rejects.toThrow("Another subscription already has this company ID.");
  });
});
