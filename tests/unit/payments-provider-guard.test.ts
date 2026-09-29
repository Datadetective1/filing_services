import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getPaymentProvider() safety on the production deployment. Nothing here touches the
 * network or a database: providers are only constructed. The server env is cached per
 * module instance, so each case loads a fresh copy of the payments module.
 */

const KEYS = [
  "VERCEL_ENV",
  "NEXT_PUBLIC_VERCEL_ENV",
  "PAYMENTS_PROVIDER",
  "PAYMENTS_LIVE_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ALLOW_REAL_PAYMENTS_IN_TESTS",
  "ALLOW_TEST_PAYMENTS_IN_PRODUCTION",
  "ALLOW_SANDBOX_IN_PRODUCTION",
] as const;

// Fake, clearly non-secret key shapes. The adapter only inspects the prefix.
const TEST_KEY = "sk_test_unit_000000000000000000000000";
const LIVE_KEY = "sk_live_unit_000000000000000000000000";
const WEBHOOK = "whsec_unit_0000000000000000";

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function load(vars: Partial<Record<(typeof KEYS)[number], string>>) {
  Object.assign(process.env, vars);
  const payments = await import("@/lib/payments");
  const types = await import("@/lib/payments/types");
  return { ...payments, PaymentConfigurationError: types.PaymentConfigurationError };
}

const REAL = { ALLOW_REAL_PAYMENTS_IN_TESTS: "true" } as const;

describe("getPaymentProvider outside production", () => {
  it("still uses the sandbox on staging and locally", async () => {
    const m = await load({ ...REAL, PAYMENTS_PROVIDER: "sandbox", VERCEL_ENV: "preview" });
    expect(m.getPaymentProvider()).toMatchObject({ name: "sandbox", mode: "sandbox" });
    expect(m.getPaymentReadiness()).toEqual({ mode: "sandbox", ready: true, reason: null });
  });

  it("allows Stripe test keys on previews", async () => {
    const m = await load({ ...REAL, PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: TEST_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(m.getPaymentProvider()).toMatchObject({ name: "stripe", mode: "test" });
    expect(m.getPaymentReadiness()).toMatchObject({ mode: "test", ready: true });
  });

  it("keeps the test runner on the sandbox even when production is simulated", async () => {
    const m = await load({ VERCEL_ENV: "production", PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: LIVE_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(m.getPaymentProvider()).toMatchObject({ name: "sandbox", mode: "sandbox" });
  });
});

describe("getPaymentProvider on the production deployment", () => {
  it("refuses the sandbox", async () => {
    const m = await load({ ...REAL, VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox" });
    expect(() => m.getPaymentProvider()).toThrow(m.PaymentConfigurationError);
    expect(m.getPaymentReadiness()).toMatchObject({ mode: "disabled", ready: false });
    expect(m.getPaymentReadiness().reason).toMatch(/sandbox/i);
  });

  it("refuses the sandbox when only the public env flag says production", async () => {
    const m = await load({ ...REAL, NEXT_PUBLIC_VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox" });
    expect(() => m.getPaymentProvider()).toThrow(m.PaymentConfigurationError);
  });

  it("refuses Stripe test keys", async () => {
    const m = await load({ ...REAL, VERCEL_ENV: "production", PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: TEST_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(() => m.getPaymentProvider()).toThrow(m.PaymentConfigurationError);
    expect(m.getPaymentReadiness()).toMatchObject({ mode: "disabled", ready: false });
  });

  it("refuses live keys unless PAYMENTS_LIVE_ENABLED is 'true'", async () => {
    const m = await load({ ...REAL, VERCEL_ENV: "production", PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: LIVE_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(() => m.getPaymentProvider()).toThrow(/PAYMENTS_LIVE_ENABLED/);
    expect(m.getPaymentReadiness()).toMatchObject({ mode: "disabled", ready: false });
  });

  it("accepts live keys when live payments are enabled", async () => {
    const m = await load({
      ...REAL,
      VERCEL_ENV: "production",
      PAYMENTS_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: LIVE_KEY,
      STRIPE_WEBHOOK_SECRET: WEBHOOK,
      PAYMENTS_LIVE_ENABLED: "true",
    });
    expect(m.getPaymentProvider()).toMatchObject({ name: "stripe", mode: "live" });
    expect(m.getPaymentReadiness()).toEqual({ mode: "live", ready: true, reason: null });
  });

  it("allows test payments only through the explicit override", async () => {
    const sandbox = await load({ ...REAL, VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox", ALLOW_TEST_PAYMENTS_IN_PRODUCTION: "true" });
    expect(sandbox.getPaymentProvider()).toMatchObject({ mode: "sandbox" });
    vi.resetModules();
    const stripe = await load({ PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: TEST_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(stripe.getPaymentProvider()).toMatchObject({ mode: "test" });
  });

  it("ignores the removed ALLOW_SANDBOX_IN_PRODUCTION alias", async () => {
    const sandbox = await load({ ...REAL, VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox", ALLOW_SANDBOX_IN_PRODUCTION: "true" });
    expect(() => sandbox.getPaymentProvider()).toThrow(sandbox.PaymentConfigurationError);
    expect(sandbox.getPaymentReadiness()).toMatchObject({ mode: "disabled", ready: false });
    vi.resetModules();
    const stripe = await load({ PAYMENTS_PROVIDER: "stripe", STRIPE_SECRET_KEY: TEST_KEY, STRIPE_WEBHOOK_SECRET: WEBHOOK });
    expect(() => stripe.getPaymentProvider()).toThrow(stripe.PaymentConfigurationError);
  });
});

describe("requiresApprovedPrice", () => {
  it("allows a provisional price only off production and outside live mode", async () => {
    const staging = await load({ VERCEL_ENV: "preview" });
    expect(staging.requiresApprovedPrice("sandbox")).toBe(false);
    expect(staging.requiresApprovedPrice("test")).toBe(false);
    expect(staging.requiresApprovedPrice("live")).toBe(true);
    vi.resetModules();
    const production = await load({ VERCEL_ENV: "production" });
    expect(production.requiresApprovedPrice("sandbox")).toBe(true);
    expect(production.requiresApprovedPrice("disabled")).toBe(true);
    expect(production.requiresApprovedPrice("live")).toBe(true);
  });
});
