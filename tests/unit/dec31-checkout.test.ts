import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findRule, isSellableForBusiness } from "@/lib/compliance/registry";
import { contentHashOf, versionRow } from "@/lib/compliance/seed-data";
import type { ServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import type { PaymentProvider } from "@/lib/payments/types";

/**
 * Pennsylvania entity types due December 31: the public quote, and checkout start once
 * the filing is authorized. The database and the payment provider are in-memory fakes
 * (sandbox and live modes); the rule snapshot is the real seeded rule version. Nothing
 * here touches the network, a real database or a real processor.
 */

type Row = Record<string, unknown>;

const h = vi.hoisted(() => ({
  filingId: "22222222-3333-4444-8555-666666666666",
  filing: null as Record<string, unknown> | null,
  authSha: null as string | null,
  inserts: [] as { table: string; payload: unknown }[],
  provider: null as unknown,
  prices: [] as unknown[],
}));

function builder(table: string, resolve: (op: string) => { data: unknown; error: unknown }) {
  let op = "select";
  const b = {
    select: () => b,
    insert: (payload: unknown) => ((op = "insert"), h.inserts.push({ table, payload }), b),
    update: () => ((op = "update"), b),
    eq: () => b,
    order: () => b,
    limit: () => b,
    maybeSingle: async () => resolve(op),
    single: async () => resolve(op),
    then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(resolve(op)).then(ok, fail),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      builder(table, (op) => {
        if (table === "filing_authorizations") return { data: h.authSha ? { answers_sha256: h.authSha } : null, error: null };
        if (table === "payments" && op === "select") return { data: [], error: null };
        if (table === "payments" && op === "insert") return { data: { id: "pay-new" }, error: null };
        if (table === "orders" && op === "insert") return { data: { id: "order-new" }, error: null };
        return { data: null, error: null };
      }),
    rpc: async () => ({ data: {}, error: null }),
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
  validateAll: () => ({ ok: true, values: { legal_name: "Example Partners LP" } }),
  validateSection: vi.fn(),
}));
vi.mock("@/lib/filings/rules-db", () => ({
  listActivePrices: async () => h.prices,
  listActivePricesAdmin: async () => h.prices,
  getCurrentRuleVersion: vi.fn(),
}));
vi.mock("@/lib/registry/state-status", () => ({ knownStateStatus: async () => null }));
vi.mock("@/lib/payments/process-event", () => ({ afterPaymentSucceeded: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/staff", () => ({ notifyStaffOfCustomerMessage: vi.fn() }));
vi.mock("@/lib/reminders/engine", () => ({ ensureRemindersForRequirement: vi.fn(), rollForwardRequirement: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/security/request", () => ({ clientIpHash: vi.fn(), userAgent: vi.fn() }));

const DEC31: { entityType: EntityType; isNonprofit: boolean; gov: number; total: number }[] = [
  { entityType: "lp", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "llp", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "electing_partnership", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "professional_association", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "business_trust", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "lp", isNonprofit: true, gov: 0, total: 4900 },
];

/** Production's price: one active, approved PA row for every entity type. */
const PA_PRICE: ServicePrice = { id: "price-pa", filingTypeCode: "annual_report", stateCode: "PA", entityType: null, serviceFeeCents: 4900, approved: true, active: true };
const USER = { id: "user-1", email: "owner@unit-test-only.com" } as never;

function rule(entityType: EntityType) {
  const r = findRule("PA", entityType);
  if (!r) throw new Error(`no PA rule for ${entityType}`);
  return r;
}

function fakeProvider(mode: "sandbox" | "live") {
  return {
    name: mode === "sandbox" ? ("sandbox" as const) : ("stripe" as const),
    mode,
    retrieveSession: vi.fn(),
    expireSession: vi.fn(),
    createCheckoutSession: vi.fn(async () => ({ sessionId: "cs_new", url: "https://checkout.example/cs_new" })),
    parseWebhook: vi.fn(),
    refund: vi.fn(),
  } satisfies PaymentProvider;
}

/** A draft filing whose rule_snapshot is the seeded rule version for this entity type. */
function setFiling(entityType: EntityType, isNonprofit: boolean) {
  const snapshot = versionRow(rule(entityType), contentHashOf(rule(entityType), (s) => createHash("sha256").update(s).digest("hex")));
  h.filing = {
    id: h.filingId,
    user_id: "user-1",
    status: "draft",
    state_code: "PA",
    business_id: "biz-1",
    rule_version_id: "rv-1",
    due_date: "2026-12-31",
    order_id: null,
    rule_snapshot: snapshot,
    businesses: { id: "biz-1", entity_type: entityType, is_foreign: false, is_nonprofit: isNonprofit, legal_name: "Example Partners LP" },
    filing_answers: { answers: {}, completed_steps: [], is_complete: true },
    orders: null,
  };
}

const inserted = (table: string) => h.inserts.filter((i) => i.table === table).map((i) => i.payload as Row);

beforeEach(async () => {
  const { stableStringify } = await import("@/lib/compliance/hash");
  h.authSha = createHash("sha256").update(stableStringify({ legal_name: "Example Partners LP" })).digest("hex");
  h.inserts = [];
  h.prices = [PA_PRICE];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(DEC31)("PA $entityType (nonprofit: $isNonprofit), due December 31", (c) => {
  it("is verified, due December 31 and open for sale, including where real money can be taken", () => {
    const r = rule(c.entityType);
    expect(r.verificationStatus).toBe("verified");
    expect(r.dueRule).toEqual({ kind: "fixed_annual", month: 12, day: 31 });
    expect(isSellableForBusiness(r, { isNonprofit: c.isNonprofit })).toBe(true);
    vi.stubEnv("PAYMENTS_LIVE_ENABLED", "true");
    expect(isSellableForBusiness(r, { isNonprofit: c.isNonprofit })).toBe(true);
  });

  it(`public quote: state fee + $49 service fee = $${c.total / 100}`, async () => {
    const { publicQuote } = await import("@/lib/compliance/public-quote");
    const q = await publicQuote(rule(c.entityType), { isNonprofit: c.isNonprofit });
    expect(q).toMatchObject({ governmentFeeCents: c.gov, serviceFeeCents: 4900, totalCents: c.total, servicePriceId: "price-pa", servicePriceApproved: true });
  });

  it("checkout is refused until the filing is authorized", async () => {
    setFiling(c.entityType, c.isNonprofit);
    h.authSha = null;
    h.provider = fakeProvider("sandbox");
    const { startCheckout } = await import("@/lib/filings/customer");
    await expect(startCheckout(USER, h.filingId)).rejects.toThrow(/authorize the filing before checkout/i);
    expect(inserted("orders")).toHaveLength(0);
  });

  it.each(["sandbox", "live"] as const)("once authorized, checkout starts (%s) with the order totals split state fee / service fee", async (mode) => {
    setFiling(c.entityType, c.isNonprofit);
    const provider = fakeProvider(mode);
    h.provider = provider;
    const { startCheckout } = await import("@/lib/filings/customer");

    const res = await startCheckout(USER, h.filingId);

    expect(res.url).toBe("https://checkout.example/cs_new");
    const [order] = inserted("orders");
    expect(order).toMatchObject({ government_fee_cents: c.gov, service_fee_cents: 4900, total_cents: c.total, payment_mode: mode, status: "pending_payment" });
    expect(inserted("payments")[0]).toMatchObject({ amount_cents: c.total, mode });
    const items = inserted("order_items")[0] as unknown as Row[];
    expect(items.map((i) => [i.kind, i.amount_cents])).toEqual([
      ["government_fee", c.gov],
      ["service_fee", 4900],
    ]);
    expect(provider.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ totalCents: c.total, currency: "usd" }));
  });
});

describe("live checkout for a December 31 type", () => {
  it("refuses an unapproved price, as for every other type", async () => {
    setFiling("lp", false);
    h.prices = [{ ...PA_PRICE, approved: false }];
    h.provider = fakeProvider("live");
    const { startCheckout } = await import("@/lib/filings/customer");
    await expect(startCheckout(USER, h.filingId)).rejects.toThrow(/isn't open yet/i);
    expect(inserted("orders")).toHaveLength(0);
  });
});
