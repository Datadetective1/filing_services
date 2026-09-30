import { describe, expect, it } from "vitest";
import {
  isStripeReady,
  REQUIRED_STRIPE_EVENTS,
  STRIPE_API_VERSION,
  STRIPE_WEBHOOK_URL,
  summarizeAccount,
  summarizeWebhook,
} from "@/lib/payments/stripe-health";

const endpoint = (over: Partial<{ url: string; status: string; enabled_events: string[]; api_version: string | null }> = {}) => ({
  url: STRIPE_WEBHOOK_URL,
  status: "enabled",
  enabled_events: [...REQUIRED_STRIPE_EVENTS],
  api_version: STRIPE_API_VERSION,
  ...over,
});

const liveAccount = summarizeAccount({
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  settings: { payments: { statement_descriptor: "FILEWELL" } },
  requirements: { currently_due: [], past_due: [], disabled_reason: null },
});

describe("Stripe status check", () => {
  it("targets the canonical www webhook URL (Stripe does not follow the apex redirect)", () => {
    expect(STRIPE_WEBHOOK_URL).toBe("https://www.getfilewell.com/api/webhooks/payments/stripe");
  });

  it("requires exactly the events the adapter handles", () => {
    expect([...REQUIRED_STRIPE_EVENTS].sort()).toEqual(
      [
        "checkout.session.async_payment_failed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.completed",
        "checkout.session.expired",
        "refund.created",
        "refund.updated",
      ].sort(),
    );
  });

  it("is ready with charges on, no past-due requirements and a complete, enabled endpoint", () => {
    const w = summarizeWebhook([endpoint()]);
    expect(w).toEqual({ found: true, enabled: true, missingEvents: [], apiVersion: STRIPE_API_VERSION, apiVersionMatches: true });
    expect(isStripeReady(liveAccount, w)).toBe(true);
    expect(liveAccount.statementDescriptor).toBe("FILEWELL");
  });

  it("accepts a wildcard endpoint", () => {
    expect(summarizeWebhook([endpoint({ enabled_events: ["*"] })]).missingEvents).toEqual([]);
  });

  it("reports a missing endpoint, an endpoint on the apex host, missing events, a disabled endpoint and a wrong API version", () => {
    expect(summarizeWebhook([]).found).toBe(false);
    expect(summarizeWebhook([endpoint({ url: "https://getfilewell.com/api/webhooks/payments/stripe" })]).found).toBe(false);
    expect(summarizeWebhook([endpoint({ enabled_events: ["checkout.session.completed"] })]).missingEvents).toHaveLength(5);
    const disabled = summarizeWebhook([endpoint({ status: "disabled" })]);
    expect(disabled.enabled).toBe(false);
    expect(isStripeReady(liveAccount, disabled)).toBe(false);
    const oldVersion = summarizeWebhook([endpoint({ api_version: "2024-06-20" })]);
    expect(oldVersion.apiVersionMatches).toBe(false);
    expect(isStripeReady(liveAccount, oldVersion)).toBe(false);
  });

  it("prefers the enabled endpoint when a disabled duplicate exists", () => {
    expect(summarizeWebhook([endpoint({ status: "disabled" }), endpoint()]).enabled).toBe(true);
  });

  it("is not ready while Stripe has charges off or past-due requirements", () => {
    const w = summarizeWebhook([endpoint()]);
    const pending = summarizeAccount({ charges_enabled: false, requirements: { currently_due: ["external_account"], past_due: [], disabled_reason: "requirements.past_due" } });
    expect(pending.currentlyDue).toEqual(["external_account"]);
    expect(isStripeReady(pending, w)).toBe(false);
    const pastDue = summarizeAccount({ charges_enabled: true, requirements: { past_due: ["individual.verification.document"] } });
    expect(isStripeReady(pastDue, w)).toBe(false);
  });
});
