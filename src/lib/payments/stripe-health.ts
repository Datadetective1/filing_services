import "server-only";
import Stripe from "stripe";
import { CANONICAL_PRODUCTION_URL } from "@/config/site";
import { env } from "@/lib/env";

/**
 * Read-only check of the Stripe account and webhook endpoint for the staff status panel.
 * It runs whenever a Stripe key is configured, even while PAYMENTS_LIVE_ENABLED is false,
 * so the owner can confirm the live setup before switching checkout on. It only reads
 * (GET /v1/account, GET /v1/webhook_endpoints) and never returns a secret.
 */

/** Events the adapter handles (src/lib/payments/stripe.ts); the endpoint must send all of them. */
export const REQUIRED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "refund.created",
  "refund.updated",
] as const;

export const STRIPE_WEBHOOK_URL = `${CANONICAL_PRODUCTION_URL}/api/webhooks/payments/stripe`;

/** The API version the SDK is pinned to; the endpoint's payloads must use the same shape. */
export const STRIPE_API_VERSION: string = Stripe.API_VERSION;

export interface StripeAccountSummary {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  statementDescriptor: string | null;
  currentlyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
}

export interface StripeWebhookSummary {
  found: boolean;
  enabled: boolean;
  missingEvents: string[];
  apiVersion: string | null;
  apiVersionMatches: boolean;
}

export type StripeHealth =
  | { state: "not_configured"; reason: string }
  | { state: "error"; mode: "live" | "test"; reason: string }
  | { state: "checked"; mode: "live" | "test"; account: StripeAccountSummary; webhook: StripeWebhookSummary; ready: boolean };

type AccountLike = {
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  settings?: { payments?: { statement_descriptor?: string | null } | null } | null;
  requirements?: { currently_due?: string[] | null; past_due?: string[] | null; disabled_reason?: string | null } | null;
};

type EndpointLike = { url: string; status: string; enabled_events: string[]; api_version?: string | null };

export function summarizeAccount(a: AccountLike): StripeAccountSummary {
  return {
    chargesEnabled: Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
    statementDescriptor: a.settings?.payments?.statement_descriptor ?? null,
    currentlyDue: a.requirements?.currently_due ?? [],
    pastDue: a.requirements?.past_due ?? [],
    disabledReason: a.requirements?.disabled_reason ?? null,
  };
}

/** Picks the endpoint for our webhook URL (an enabled one first) and reports what is wrong with it. */
export function summarizeWebhook(endpoints: EndpointLike[], url: string = STRIPE_WEBHOOK_URL): StripeWebhookSummary {
  const matches = endpoints.filter((e) => e.url === url);
  const ep = matches.find((e) => e.status === "enabled") ?? matches[0];
  if (!ep) return { found: false, enabled: false, missingEvents: [...REQUIRED_STRIPE_EVENTS], apiVersion: null, apiVersionMatches: false };
  const all = ep.enabled_events.includes("*");
  const apiVersion = ep.api_version ?? null;
  return {
    found: true,
    enabled: ep.status === "enabled",
    missingEvents: all ? [] : REQUIRED_STRIPE_EVENTS.filter((e) => !ep.enabled_events.includes(e)),
    apiVersion,
    apiVersionMatches: apiVersion === STRIPE_API_VERSION,
  };
}

export function isStripeReady(account: StripeAccountSummary, webhook: StripeWebhookSummary): boolean {
  return (
    account.chargesEnabled &&
    account.pastDue.length === 0 &&
    !account.disabledReason &&
    webhook.found &&
    webhook.enabled &&
    webhook.missingEvents.length === 0 &&
    webhook.apiVersionMatches
  );
}

export async function checkStripe(): Promise<StripeHealth> {
  const e = env();
  if (e.PAYMENTS_PROVIDER !== "stripe") return { state: "not_configured", reason: "PAYMENTS_PROVIDER is not stripe on this deployment." };
  const key = e.STRIPE_SECRET_KEY;
  if (!key) return { state: "not_configured", reason: "STRIPE_SECRET_KEY is not set." };
  const mode = /^(sk|rk)_live_/.test(key) ? "live" : "test";
  if (!e.STRIPE_WEBHOOK_SECRET) return { state: "error", mode, reason: "STRIPE_WEBHOOK_SECRET is not set." };
  try {
    const stripe = new Stripe(key, { maxNetworkRetries: 0, timeout: 8000, appInfo: { name: "filewell" } });
    const [account, endpoints] = await Promise.all([stripe.accounts.retrieveCurrent(), stripe.webhookEndpoints.list({ limit: 100 })]);
    const a = summarizeAccount(account);
    const w = summarizeWebhook(endpoints.data);
    return { state: "checked", mode, account: a, webhook: w, ready: isStripeReady(a, w) };
  } catch (err) {
    // Stripe error messages never contain the key.
    return { state: "error", mode, reason: err instanceof Error ? err.message.slice(0, 160) : "Stripe could not be reached." };
  }
}
