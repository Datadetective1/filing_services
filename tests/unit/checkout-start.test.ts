import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServicePrice } from "@/lib/domain/pricing";
import type { PaymentProvider, SessionStatus } from "@/lib/payments/types";

/**
 * startCheckout order and session handling, with the database and the payment
 * provider replaced by in-memory fakes. Nothing here touches the network, a real
 * database or a real processor.
 */

type Row = Record<string, unknown>;
interface Call {
  table: string;
  op: "select" | "insert" | "update";
  payload?: unknown;
  filters: Array<[string, unknown]>;
}

const h = vi.hoisted(() => ({
  filingId: "11111111-2222-4333-8444-555555555555",
  filing: null as Row | null,
  authSha: "",
  openPayments: [] as Row[],
  calls: [] as Call[],
  rpcs: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  provider: null as unknown,
  prices: [] as unknown[],
  afterPaymentSucceeded: vi.fn(async () => {}),
}));

function builder(table: string, resolve: (c: Call) => { data: unknown; error: unknown }) {
  const call: Call = { table, op: "select", filters: [] };
  let recorded = false;
  const run = () => {
    if (!recorded) {
      h.calls.push(call);
      recorded = true;
    }
    return Promise.resolve(resolve(call));
  };
  const b = {
    select: () => b,
    insert: (payload: unknown) => ((call.op = "insert"), (call.payload = payload), b),
    update: (payload: unknown) => ((call.op = "update"), (call.payload = payload), b),
    eq: (col: string, val: unknown) => (call.filters.push([col, val]), b),
    order: () => b,
    limit: () => b,
    maybeSingle: run,
    single: run,
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => run().then(onFulfilled, onRejected),
  };
  return b;
}

function resolveAdmin(c: Call): { data: unknown; error: unknown } {
  if (c.table === "filing_authorizations") return { data: { answers_sha256: h.authSha }, error: null };
  if (c.table === "payments" && c.op === "select") return { data: h.openPayments, error: null };
  if (c.table === "payments" && c.op === "insert") return { data: { id: "pay-new" }, error: null };
  if (c.table === "orders" && c.op === "insert") return { data: { id: "order-new" }, error: null };
  return { data: null, error: null };
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => builder(table, resolveAdmin),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcs.push({ fn, args });
      if (fn === "apply_payment_success") return { data: { applied: true, filing_id: h.filingId, order_id: "order-old" }, error: null };
      return { data: {}, error: null };
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => builder(`user:${table}`, () => ({ data: h.filing, error: null })) }),
}));
vi.mock("@/lib/payments", () => ({
  getPaymentProvider: () => h.provider,
  requiresApprovedPrice: (mode: string) => mode === "live",
}));
vi.mock("@/lib/intake/validate", () => ({
  validateAll: () => ({ ok: true, values: { business_name: "Acme LLC" } }),
  validateSection: vi.fn(),
}));
vi.mock("@/lib/filings/rules-db", () => ({
  listActivePricesAdmin: async () => h.prices,
  getCurrentRuleVersion: vi.fn(),
}));
vi.mock("@/lib/payments/process-event", () => ({ afterPaymentSucceeded: h.afterPaymentSucceeded }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/staff", () => ({ notifyStaffOfCustomerMessage: vi.fn() }));
vi.mock("@/lib/reminders/engine", () => ({ ensureRemindersForRequirement: vi.fn(), rollForwardRequirement: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/security/request", () => ({ clientIpHash: vi.fn(), userAgent: vi.fn() }));

const FILING_ID = h.filingId;
const USER = { id: "user-1", email: "owner@example.com" } as never;
const TOTAL = 5600; // $7 PA state fee + $49 service fee

function fakeProvider(mode: "sandbox" | "live", sessions: Array<Partial<SessionStatus> | null> = []) {
  const queue = [...sessions];
  return {
    name: mode === "sandbox" ? ("sandbox" as const) : ("stripe" as const),
    mode,
    retrieveSession: vi.fn(async (sessionId: string) => {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return next === null || next === undefined ? null : ({ sessionId, amountCents: TOTAL, currency: "usd", providerPaymentId: "pi_1", orderId: "order-old", paymentId: "pay-old", paid: false, status: "open", ...next } as SessionStatus);
    }),
    expireSession: vi.fn(async () => {}),
    createCheckoutSession: vi.fn(async () => ({ sessionId: "cs_new", url: "https://checkout.example/cs_new" })),
    parseWebhook: vi.fn(),
    refund: vi.fn(),
  } satisfies PaymentProvider;
}

function setFiling(order: Row | null) {
  h.filing = {
    id: FILING_ID,
    user_id: "user-1",
    status: "draft",
    state_code: "PA",
    business_id: "biz-1",
    rule_version_id: "rv-1",
    order_id: order?.id ?? null,
    rule_snapshot: { intake_schema: {}, filing_name: "Annual Report", state_fee_cents: 700, nonprofit_state_fee_cents: null },
    businesses: { id: "biz-1", entity_type: "llc", is_foreign: false, is_nonprofit: false, legal_name: "Acme LLC" },
    filing_answers: { answers: {}, completed_steps: [], is_complete: true },
    orders: order,
  };
}

const pendingPayment = (over: Row = {}): Row => ({
  id: "pay-old",
  order_id: "order-old",
  provider: "sandbox",
  mode: "sandbox",
  provider_session_id: "sbx_cs_old",
  created_at: new Date().toISOString(),
  ...over,
});

const calls = (table: string, op: Call["op"]) => h.calls.filter((c) => c.table === table && c.op === op);
const rpc = (fn: string) => h.rpcs.filter((r) => r.fn === fn);

beforeEach(async () => {
  const { stableStringify } = await import("@/lib/compliance/hash");
  h.authSha = createHash("sha256").update(stableStringify({ business_name: "Acme LLC" })).digest("hex");
  h.calls.length = 0;
  h.rpcs.length = 0;
  h.openPayments = [];
  h.afterPaymentSucceeded.mockClear();
  h.prices = [{ id: "price-pa", filingTypeCode: "annual_report", stateCode: "PA", entityType: null, serviceFeeCents: 4900, approved: true, active: true } satisfies ServicePrice];
});

async function start() {
  const { startCheckout } = await import("@/lib/filings/customer");
  return startCheckout(USER, FILING_ID);
}

describe("startCheckout reusing a pending order", () => {
  it("replaces a sandbox order when checkout is now live, and expires its pending payment", async () => {
    setFiling({ id: "order-old", status: "pending_payment", payment_mode: "sandbox", total_cents: TOTAL });
    h.openPayments = [pendingPayment()];
    const provider = fakeProvider("live");
    h.provider = provider;

    const res = await start();

    expect(res.url).toBe("https://checkout.example/cs_new");
    // The sandbox session is unreachable by the live provider and moved no money.
    expect(provider.retrieveSession).not.toHaveBeenCalled();
    expect(rpc("apply_payment_failure")).toEqual([
      { fn: "apply_payment_failure", args: expect.objectContaining({ p_payment_id: "pay-old", p_status: "expired" }) },
    ]);
    const cancelled = calls("orders", "update");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].payload).toMatchObject({ status: "cancelled" });
    expect(cancelled[0].filters).toContainEqual(["id", "order-old"]);
    const inserted = calls("orders", "insert");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].payload).toMatchObject({ payment_mode: "live", total_cents: TOTAL, status: "pending_payment" });
    expect(calls("payments", "insert")[0].payload).toMatchObject({ order_id: "order-new", mode: "live", provider: "stripe" });
  });

  it("reuses an order whose total and payment mode still match", async () => {
    setFiling({ id: "order-old", status: "payment_failed", payment_mode: "sandbox", total_cents: TOTAL });
    h.provider = fakeProvider("sandbox");

    await start();

    expect(calls("orders", "insert")).toHaveLength(0);
    const updated = calls("orders", "update");
    expect(updated).toHaveLength(1);
    expect(updated[0].payload).toEqual({ status: "pending_payment" });
    expect(updated[0].filters).toContainEqual(["id", "order-old"]);
    expect(calls("payments", "insert")[0].payload).toMatchObject({ order_id: "order-old", mode: "sandbox" });
  });

  it("replaces an order whose total no longer matches the quote", async () => {
    setFiling({ id: "order-old", status: "pending_payment", payment_mode: "sandbox", total_cents: 9900 });
    h.provider = fakeProvider("sandbox");

    await start();

    expect(calls("orders", "update")[0].payload).toMatchObject({ status: "cancelled" });
    expect(calls("orders", "insert")[0].payload).toMatchObject({ total_cents: TOTAL });
  });
});

describe("startCheckout with an older checkout session", () => {
  beforeEach(() => {
    setFiling({ id: "order-old", status: "pending_payment", payment_mode: "sandbox", total_cents: TOTAL });
    h.openPayments = [pendingPayment()];
  });

  it("applies a session that was already paid instead of opening a second checkout", async () => {
    const provider = fakeProvider("sandbox", [{ status: "complete", paid: true }]);
    h.provider = provider;

    const res = await start();

    expect(res.url).toMatch(new RegExp(`/file/${FILING_ID}/confirmation\\?session_id=sbx_cs_old$`));
    expect(provider.expireSession).not.toHaveBeenCalled();
    expect(provider.createCheckoutSession).not.toHaveBeenCalled();
    expect(rpc("apply_payment_failure")).toHaveLength(0);
    expect(rpc("apply_payment_success")).toEqual([
      {
        fn: "apply_payment_success",
        args: expect.objectContaining({ p_payment_id: "pay-old", p_amount_cents: TOTAL, p_currency: "usd", p_provider_payment_id: "pi_1" }),
      },
    ]);
    expect(h.afterPaymentSucceeded).toHaveBeenCalledWith(FILING_ID, "order-old", "user-1");
    expect(calls("payments", "insert")).toHaveLength(0);
    expect(calls("orders", "update")).toHaveLength(0);
    expect(calls("orders", "insert")).toHaveLength(0);
  });

  it("expires an open session, confirms it can no longer be paid, then opens a new one", async () => {
    const provider = fakeProvider("sandbox", [{ status: "open" }, { status: "expired" }]);
    h.provider = provider;

    const res = await start();

    expect(provider.expireSession).toHaveBeenCalledWith("sbx_cs_old");
    expect(provider.retrieveSession).toHaveBeenCalledTimes(2);
    expect(rpc("apply_payment_failure")[0].args).toMatchObject({ p_payment_id: "pay-old", p_status: "expired" });
    expect(rpc("apply_payment_success")).toHaveLength(0);
    expect(provider.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(res.url).toBe("https://checkout.example/cs_new");
  });

  it("applies a session paid between the first check and the expiry", async () => {
    const provider = fakeProvider("sandbox", [{ status: "open" }, { status: "complete", paid: true }]);
    h.provider = provider;

    const res = await start();

    expect(provider.expireSession).toHaveBeenCalledTimes(1);
    expect(rpc("apply_payment_success")).toHaveLength(1);
    expect(rpc("apply_payment_failure")).toHaveLength(0);
    expect(provider.createCheckoutSession).not.toHaveBeenCalled();
    expect(res.url).toContain("/confirmation?session_id=sbx_cs_old");
  });

  it("refuses to open a new checkout when the older session can't be checked", async () => {
    const provider = fakeProvider("sandbox", [null]);
    h.provider = provider;
    const { FilingError } = await import("@/lib/filings/customer");

    await expect(start()).rejects.toBeInstanceOf(FilingError);
    expect(rpc("apply_payment_failure")).toHaveLength(0);
    expect(provider.createCheckoutSession).not.toHaveBeenCalled();
    expect(calls("payments", "insert")).toHaveLength(0);
  });

  it("refuses when the provider reports the session paid under a different payment", async () => {
    const provider = fakeProvider("sandbox", [{ status: "complete", paid: true, paymentId: "someone-else" }]);
    h.provider = provider;

    await expect(start()).rejects.toThrow(/earlier checkout/);
    expect(rpc("apply_payment_success")).toHaveLength(0);
    expect(provider.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("releases an unreachable session once it is too old to be payable", async () => {
    h.openPayments = [pendingPayment({ created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() })];
    const provider = fakeProvider("sandbox", [null]);
    h.provider = provider;

    await start();

    expect(rpc("apply_payment_failure")[0].args).toMatchObject({ p_payment_id: "pay-old" });
    expect(provider.createCheckoutSession).toHaveBeenCalledTimes(1);
  });
});
