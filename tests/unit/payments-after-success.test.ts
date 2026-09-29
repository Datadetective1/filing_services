import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rows the service-role client returns, keyed by table. Each query records its filters.
const rows: Record<string, { data: unknown; error: unknown }> = {};
const queries: { table: string; columns: string; filters: [string, unknown][] }[] = [];

function fakeQuery(table: string) {
  const q = { table, columns: "", filters: [] as [string, unknown][] };
  queries.push(q);
  const result = () => Promise.resolve(rows[table] ?? { data: null, error: null });
  const chain = {
    select(columns: string) {
      q.columns = columns;
      return chain;
    },
    eq(col: string, val: unknown) {
      q.filters.push([col, val]);
      return chain;
    },
    single: result,
    maybeSingle: result,
  };
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => fakeQuery(table) }),
}));

const loadFilingContext = vi.fn();
vi.mock("@/lib/filings/context", () => ({ loadFilingContext: (...a: unknown[]) => loadFilingContext(...a) }));

const sendNotification = vi.fn();
vi.mock("@/lib/notifications/send", () => ({ sendNotification: (...a: unknown[]) => sendNotification(...a) }));

const notifyStaff = vi.fn();
vi.mock("@/lib/notifications/staff", () => ({ notifyStaff: (...a: unknown[]) => notifyStaff(...a) }));

const trackServer = vi.fn();
vi.mock("@/lib/analytics/server", () => ({ trackServer: (...a: unknown[]) => trackServer(...a) }));

const { afterPaymentSucceeded, afterRefundSucceeded } = await import("@/lib/payments/process-event");

const CTX = {
  filing: { id: "f1", businessId: "b1", stateCode: "PA" },
  vars: { company_name: "Acme LLC", state_name: "Pennsylvania", filing_title: "Annual Report" },
};

function orderRow(payment_mode: "sandbox" | "test" | "live") {
  return { data: { government_fee_cents: 700, service_fee_cents: 4900, total_cents: 5600, payment_mode }, error: null };
}

function setEnvironment(env: "production" | "preview" | "") {
  vi.stubEnv("VERCEL_ENV", env);
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", env);
}

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  queries.length = 0;
  loadFilingContext.mockReset().mockResolvedValue(CTX);
  sendNotification.mockReset().mockResolvedValue({ status: "sent", notificationId: "n1" });
  notifyStaff.mockReset().mockResolvedValue([]);
  trackServer.mockReset().mockResolvedValue(undefined);
  setEnvironment("");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("afterPaymentSucceeded", () => {
  it("sends order_confirmed with the state fee, service fee and total from the order row", async () => {
    rows.orders = orderRow("sandbox");
    await afterPaymentSucceeded("f1", "order-1", "user-1");

    const orderQuery = queries.find((q) => q.table === "orders")!;
    expect(orderQuery.filters).toEqual([["id", "order-1"]]);
    expect(orderQuery.columns).toContain("government_fee_cents");
    expect(orderQuery.columns).toContain("service_fee_cents");
    expect(orderQuery.columns).toContain("payment_mode");

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toEqual({
      userId: "user-1",
      templateKey: "order_confirmed",
      dedupeKey: "order_confirmed:order-1",
      vars: { ...CTX.vars, government_fee: "$7.00", service_fee: "$49.00", amount: "$56.00" },
      ctaPath: "/dashboard/filings/f1",
      filingId: "f1",
      businessId: "b1",
      suppressReason: null,
    });
  });

  it("suppresses the customer's confirmation for a test-mode payment in production", async () => {
    setEnvironment("production");
    rows.orders = orderRow("sandbox");
    await afterPaymentSucceeded("f1", "order-1", "user-1");
    expect(sendNotification.mock.calls[0][0].suppressReason).toBe("test-mode payment (no real charge)");

    sendNotification.mockClear();
    rows.orders = orderRow("test");
    await afterPaymentSucceeded("f1", "order-2", "user-1");
    expect(sendNotification.mock.calls[0][0].suppressReason).toBe("test-mode payment (no real charge)");
  });

  it("delivers the confirmation for a live payment in production", async () => {
    setEnvironment("production");
    rows.orders = orderRow("live");
    await afterPaymentSucceeded("f1", "order-1", "user-1");
    expect(sendNotification.mock.calls[0][0].suppressReason).toBeNull();
  });

  it("does not suppress sandbox confirmations outside production (staging and local keep the outbox flow)", async () => {
    setEnvironment("preview");
    rows.orders = orderRow("sandbox");
    await afterPaymentSucceeded("f1", "order-1", "user-1");
    expect(sendNotification.mock.calls[0][0].suppressReason).toBeNull();
  });

  it("alerts staff with a per-order dedupe key, both fees and the payment mode", async () => {
    rows.orders = orderRow("live");
    await afterPaymentSucceeded("f1", "order-1", "user-1");
    expect(notifyStaff).toHaveBeenCalledTimes(1);
    expect(notifyStaff.mock.calls[0][0]).toEqual({
      templateKey: "staff_new_paid_order",
      vars: { ...CTX.vars, government_fee: "$7.00", service_fee: "$49.00", amount: "$56.00", payment_mode: "live" },
      dedupeKey: "staff_new_paid_order:order-1",
      ctaPath: "/admin/filings/f1",
      filingId: "f1",
      businessId: "b1",
    });
    expect(trackServer).toHaveBeenCalledWith(
      "payment_completed",
      expect.objectContaining({ userId: "user-1", dedupeKey: "payment_completed:order-1" }),
    );
  });

  it("throws before emailing anyone when the order row can't be read, so the webhook retry can reprocess", async () => {
    rows.orders = { data: null, error: { message: "db down" } };
    await expect(afterPaymentSucceeded("f1", "order-1", "user-1")).rejects.toThrow("order lookup failed: db down");
    expect(sendNotification).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });

  it("does nothing without a filing", async () => {
    await afterPaymentSucceeded(null, "order-1", "user-1");
    loadFilingContext.mockResolvedValue(null);
    await afterPaymentSucceeded("f1", "order-1", "user-1");
    expect(sendNotification).not.toHaveBeenCalled();
    expect(notifyStaff).not.toHaveBeenCalled();
  });
});

describe("afterRefundSucceeded", () => {
  it("sends refund_issued with the refunded state fee, service fee and total from the refund row", async () => {
    rows.refunds = {
      data: { id: "r1", order_id: "order-1", user_id: "user-1", amount_cents: 4900, government_fee_cents: 0, service_fee_cents: 4900 },
      error: null,
    };
    rows.filings = { data: { id: "f1" }, error: null };
    await afterRefundSucceeded("r1");

    expect(queries.find((q) => q.table === "refunds")!.filters).toEqual([["id", "r1"]]);
    expect(queries.find((q) => q.table === "filings")!.filters).toEqual([["order_id", "order-1"]]);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(sendNotification.mock.calls[0][0]).toEqual({
      userId: "user-1",
      templateKey: "refund_issued",
      dedupeKey: "refund_issued:r1",
      vars: { ...CTX.vars, amount: "$49.00", government_fee: "$0.00", service_fee: "$49.00" },
      ctaPath: "/dashboard/filings/f1",
      filingId: "f1",
      businessId: "b1",
    });
  });

  it("does nothing when the refund row is missing", async () => {
    await afterRefundSucceeded("r-missing");
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
