import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Daily staff alert for payments flagged for review. The real notifyStaff and
 * sendNotification run against an in-memory stand-in for the service-role client whose
 * notifications table enforces the unique dedupe_key, as Postgres does; the email
 * provider only records what it was given. Nothing is sent anywhere.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  sent: [] as { to: string; subject: string; text: string }[],
  nextId: 1,
  failingTable: null as string | null,
}));

function query(table: string) {
  const rows = () => (h.tables[table] ??= []);
  const state = { op: "select" as "select" | "insert" | "update", payload: null as Row | null, filters: [] as ((r: Row) => boolean)[], returning: false };
  const matching = () => rows().filter((r) => state.filters.every((f) => f(r)));
  const resolve = (single: boolean) => {
    if (table === h.failingTable) return { data: null, error: { code: "08006", message: "connection failure" } };
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

const { alertStaffOfPaymentsNeedingReview, paymentReviewAlertKey } = await import("@/lib/payments/review-alerts");

const OCT_28 = new Date("2026-10-28T13:00:00Z"); // the 13:00 UTC cron, 9 AM Eastern
const OCT_29 = new Date("2026-10-29T13:00:00Z");

function flagged(over: Row = {}): Row {
  return {
    id: "pay-1",
    order_id: "order-1",
    mode: "live",
    amount_cents: 5600,
    requires_review: true,
    review_reason: "duplicate payment for an order that was already paid - refund it",
    updated_at: "2026-10-28T01:00:00Z",
    ...over,
  };
}

beforeEach(() => {
  h.sent = [];
  h.nextId = 1;
  h.failingTable = null;
  h.tables = {
    payments: [],
    filings: [{ id: "filing-1", order_id: "order-1", business_id: "biz-1", businesses: { legal_name: "Example Partners LP" } }],
    staff_members: [{ user_id: "staff-1", active: true }],
    profiles: [{ id: "staff-1", email: "operator@unit-test-only.com" }],
    notification_templates: [],
    notifications: [],
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("alertStaffOfPaymentsNeedingReview", () => {
  it("no stuck case: no email", async () => {
    h.tables.payments = [flagged({ requires_review: false })];
    const summary = await alertStaffOfPaymentsNeedingReview(OCT_28);
    expect(summary).toEqual({ cases: 0, sent: 0, duplicate: 0, failed: 0, suppressed: 0 });
    expect(h.sent).toHaveLength(0);
    expect(h.tables.notifications).toHaveLength(0);
  });

  it("one stuck case: one email to staff, linking to the filing's payment", async () => {
    h.tables.payments = [flagged(), flagged({ id: "pay-ok", requires_review: false, review_reason: null })];
    const summary = await alertStaffOfPaymentsNeedingReview(OCT_28);
    expect(summary).toMatchObject({ cases: 1, sent: 1, duplicate: 0 });
    expect(h.sent).toHaveLength(1);
    const [email] = h.sent;
    expect(email.to).toBe("operator@unit-test-only.com");
    expect(email.subject).toBe("Payment needs review: Example Partners LP");
    expect(email.text).toContain("A payment of $56.00 for Example Partners LP is flagged for review: duplicate payment for an order that was already paid - refund it.");
    expect(email.text).toContain("Payment mode: live");
    expect(email.text).toMatch(/Open payment: .*\/r\/notifications-\d+\?to=%2Fadmin%2Ffilings%2Ffiling-1%23payment/);
    expect(h.tables.notifications).toEqual([
      expect.objectContaining({ template_key: "staff_payment_review", status: "sent", dedupe_key: "staff_payment_review:pay-1:2026-10-28:staff:staff-1", filing_id: "filing-1" }),
    ]);
  });

  it("the same case on the same day: no second email", async () => {
    h.tables.payments = [flagged()];
    await alertStaffOfPaymentsNeedingReview(OCT_28);
    const again = await alertStaffOfPaymentsNeedingReview(new Date("2026-10-28T22:00:00Z"));
    expect(again).toMatchObject({ cases: 1, sent: 0, duplicate: 1 });
    expect(h.sent).toHaveLength(1);
    expect(h.tables.notifications).toHaveLength(1);
  });

  it("the next day, while still flagged: one more email", async () => {
    h.tables.payments = [flagged()];
    await alertStaffOfPaymentsNeedingReview(OCT_28);
    const next = await alertStaffOfPaymentsNeedingReview(OCT_29);
    expect(next).toMatchObject({ cases: 1, sent: 1 });
    expect(h.sent).toHaveLength(2);
  });

  it("one email per staff member per case, and a payment without a filing links to the payments page", async () => {
    h.tables.staff_members.push({ user_id: "staff-2", active: true }, { user_id: "staff-3", active: false });
    h.tables.profiles.push({ id: "staff-2", email: "admin@unit-test-only.com" });
    h.tables.payments = [flagged(), flagged({ id: "pay-2", order_id: "order-orphan", mode: "sandbox", amount_cents: 4900, review_reason: null })];
    const summary = await alertStaffOfPaymentsNeedingReview(OCT_28);
    expect(summary).toMatchObject({ cases: 2, sent: 4 });
    expect(h.sent.map((m) => m.to).sort()).toEqual(["admin@unit-test-only.com", "admin@unit-test-only.com", "operator@unit-test-only.com", "operator@unit-test-only.com"]);
    const orphan = h.sent.find((m) => m.subject === "Payment needs review: Unknown business")!;
    expect(orphan.text).toContain("is flagged for review: flagged for review.");
    expect(orphan.text).toContain("Payment mode: sandbox");
    expect(orphan.text).toMatch(/to=%2Fadmin%2Fpayments%23review/);
  });

  it("uses the Eastern calendar day for the dedupe key", () => {
    // 11:30 PM Eastern on Oct 28 is already Oct 29 in UTC.
    expect(paymentReviewAlertKey("pay-1", new Date("2026-10-29T03:30:00Z"))).toBe("staff_payment_review:pay-1:2026-10-28");
    expect(paymentReviewAlertKey("pay-1", new Date("2026-10-29T04:30:00Z"))).toBe("staff_payment_review:pay-1:2026-10-29");
  });

  it("never throws: a failed lookup is logged and reported as no cases", async () => {
    h.tables.payments = [flagged()];
    h.failingTable = "payments";
    await expect(alertStaffOfPaymentsNeedingReview(OCT_28)).resolves.toMatchObject({ cases: 0, sent: 0 });
    expect(console.error).toHaveBeenCalledWith("[staff alert] payment review alerts failed", "connection failure");
    expect(h.sent).toHaveLength(0);
  });
});
