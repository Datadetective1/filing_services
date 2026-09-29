import "server-only";
import { isProductionEnvironment } from "@/config/site";
import { env } from "@/lib/env";
import { isTestRunner } from "@/lib/runtime";
import { SandboxPaymentProvider } from "./sandbox";
import { StripePaymentProvider } from "./stripe";
import { type PaymentProvider, PaymentConfigurationError } from "./types";

/**
 * Test payments (the sandbox simulator or Stripe test keys) mark orders paid without
 * money moving, so the production deployment refuses them. ALLOW_TEST_PAYMENTS_IN_PRODUCTION
 * is the only override; it exists for emergencies and is never set in production.
 */
function testPaymentsAllowedInProduction(): boolean {
  return process.env.ALLOW_TEST_PAYMENTS_IN_PRODUCTION === "true";
}

/**
 * The single place a payment provider is chosen. Safety is a property of the
 * object returned, not a check each caller must remember:
 *  - Under the test runner the sandbox provider is ALWAYS returned (it has no
 *    processor network code), unless ALLOW_REAL_PAYMENTS_IN_TESTS=true.
 *  - On the production deployment the sandbox and Stripe test keys are refused,
 *    whatever the indexing setting.
 *  - The Stripe adapter refuses live keys unless PAYMENTS_LIVE_ENABLED=true.
 */
export function getPaymentProvider(): PaymentProvider {
  const e = env();
  const forceSandbox = isTestRunner() && process.env.ALLOW_REAL_PAYMENTS_IN_TESTS !== "true";
  const production = isProductionEnvironment();

  if (forceSandbox || e.PAYMENTS_PROVIDER === "sandbox") {
    if (!forceSandbox && production && !testPaymentsAllowedInProduction()) {
      throw new PaymentConfigurationError("The sandbox payment provider is disabled on the production deployment. Configure Stripe.");
    }
    if (!e.SANDBOX_WEBHOOK_SECRET) throw new PaymentConfigurationError("SANDBOX_WEBHOOK_SECRET is not set");
    return new SandboxPaymentProvider(e.SANDBOX_WEBHOOK_SECRET);
  }

  if (!e.STRIPE_SECRET_KEY || !e.STRIPE_WEBHOOK_SECRET) {
    throw new PaymentConfigurationError("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required for Stripe");
  }
  const stripe = new StripePaymentProvider(e.STRIPE_SECRET_KEY, e.STRIPE_WEBHOOK_SECRET, e.PAYMENTS_LIVE_ENABLED === "true");
  if (stripe.mode !== "live" && production && !testPaymentsAllowedInProduction()) {
    throw new PaymentConfigurationError("Stripe test keys are disabled on the production deployment. Configure live keys.");
  }
  return stripe;
}

export function getProviderByName(name: string): PaymentProvider | null {
  const p = getPaymentProvider();
  return p.name === name ? p : null;
}

export type PaymentMode = "disabled" | "sandbox" | "test" | "live";

export interface PaymentReadiness {
  /** What checkout would do right now. */
  mode: PaymentMode;
  /** True when a customer can complete checkout in this environment. */
  ready: boolean;
  /** Plain-language reason when not ready (for staff and logs; never shows secrets). */
  reason: string | null;
}

/** Non-throwing summary of the payment configuration, for checkout gating and the staff status panel. */
export function getPaymentReadiness(): PaymentReadiness {
  try {
    const provider = getPaymentProvider();
    return { mode: provider.mode === "live" ? "live" : provider.mode === "test" ? "test" : "sandbox", ready: true, reason: null };
  } catch (e) {
    return { mode: "disabled", ready: false, reason: e instanceof Error ? e.message : "Payments are not configured" };
  }
}

/**
 * Whether only an approved service price may be charged: in live mode, and on the
 * production deployment whatever the mode. Staging may preview a provisional price.
 */
export function requiresApprovedPrice(mode: PaymentMode): boolean {
  return mode === "live" || isProductionEnvironment();
}
