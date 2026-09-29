import "server-only";
import { isIndexable } from "@/config/site";
import { env } from "@/lib/env";
import { isTestRunner } from "@/lib/runtime";
import { SandboxPaymentProvider } from "./sandbox";
import { StripePaymentProvider } from "./stripe";
import { type PaymentProvider, PaymentConfigurationError } from "./types";

/**
 * The single place a payment provider is chosen. Safety is a property of the
 * object returned, not a check each caller must remember:
 *  - Under the test runner the sandbox provider is ALWAYS returned (it has no
 *    processor network code), unless ALLOW_REAL_PAYMENTS_IN_TESTS=true.
 *  - The Stripe adapter refuses live keys unless PAYMENTS_LIVE_ENABLED=true.
 */
export function getPaymentProvider(): PaymentProvider {
  const e = env();
  const forceSandbox = isTestRunner() && process.env.ALLOW_REAL_PAYMENTS_IN_TESTS !== "true";

  if (forceSandbox || e.PAYMENTS_PROVIDER === "sandbox") {
    // The simulator marks orders paid without money moving: never on the public production site.
    if (!forceSandbox && isIndexable() && process.env.ALLOW_SANDBOX_IN_PRODUCTION !== "true") {
      throw new PaymentConfigurationError("The sandbox payment provider is disabled on the production site. Configure Stripe.");
    }
    if (!e.SANDBOX_WEBHOOK_SECRET) throw new PaymentConfigurationError("SANDBOX_WEBHOOK_SECRET is not set");
    return new SandboxPaymentProvider(e.SANDBOX_WEBHOOK_SECRET);
  }

  if (!e.STRIPE_SECRET_KEY || !e.STRIPE_WEBHOOK_SECRET) {
    throw new PaymentConfigurationError("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required for Stripe");
  }
  return new StripePaymentProvider(e.STRIPE_SECRET_KEY, e.STRIPE_WEBHOOK_SECRET, e.PAYMENTS_LIVE_ENABLED === "true");
}

export function getProviderByName(name: string): PaymentProvider | null {
  const p = getPaymentProvider();
  return p.name === name ? p : null;
}
