import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { SANDBOX_SIGNATURE_HEADER, SandboxPaymentProvider } from "@/lib/payments/sandbox";
import { StripePaymentProvider } from "@/lib/payments/stripe";

/**
 * Registered agent billing runs on yearly subscriptions. Checkout uses subscription mode only
 * when a yearly line is present (annual reports stay one-time payments), and the renewal
 * webhooks normalize the same way for Stripe and the sandbox. No network: the Stripe client
 * call is replaced and only the parameters are checked.
 */

const KEY = "sk_test_unit_000000000000000000000000";
const WEBHOOK = "whsec_unit_0000000000000000";

function stripeWithCapture() {
  const provider = new StripePaymentProvider(KEY, WEBHOOK, false);
  const create = vi.fn().mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" });
  (provider as unknown as { stripe: { checkout: { sessions: { create: typeof create } } } }).stripe.checkout.sessions.create = create;
  return { provider, create };
}

const base = {
  orderId: "order-1",
  paymentId: "payment-1",
  currency: "usd" as const,
  customerEmail: "owner@example.com",
  description: "Filewell order",
  successUrl: "https://example.com/done",
  cancelUrl: "https://example.com/back",
  idempotencyKey: "idem-1",
};

describe("Stripe checkout for business services", () => {
  it("uses subscription mode with a yearly line and keeps the state fee one-time", async () => {
    const { provider, create } = stripeWithCapture();
    await provider.createCheckoutSession({
      ...base,
      totalCents: 12900,
      lineItems: [
        { kind: "service_fee", name: "Registered agent", amountCents: 11900, recurring: { interval: "year" } },
        { kind: "service_fee", name: "Change filing (included)", amountCents: 0 },
        { kind: "government_fee", name: "State fee", amountCents: 1000 },
      ],
    });
    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0].price_data.recurring).toEqual({ interval: "year" });
    expect(params.line_items[1].price_data.recurring).toBeUndefined();
    expect(params.subscription_data.metadata).toEqual({ order_id: "order-1", payment_id: "payment-1" });
    expect(params.payment_intent_data).toBeUndefined();
  });

  it("keeps annual reports as one-time payments", async () => {
    const { provider, create } = stripeWithCapture();
    await provider.createCheckoutSession({ ...base, totalCents: 5600, lineItems: [{ kind: "service_fee", name: "Annual report", amountCents: 4900 }, { kind: "government_fee", name: "State fee", amountCents: 700 }] });
    const params = create.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.subscription_data).toBeUndefined();
    expect(params.payment_intent_data.metadata.order_id).toBe("order-1");
  });
});

describe("Stripe renewal webhooks", () => {
  const provider = new StripePaymentProvider(KEY, WEBHOOK, false);
  const stripe = new Stripe(KEY);
  const deliver = (type: string, object: Record<string, unknown>) => {
    const payload = JSON.stringify({ id: `evt_${type.replace(/\W/g, "_")}`, object: "event", type, created: 1, livemode: false, data: { object } });
    return provider.parseWebhook(payload, new Headers({ "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK }) }));
  };

  it("normalizes invoice.paid for a subscription", () => {
    const e = deliver("invoice.paid", {
      id: "in_1",
      object: "invoice",
      billing_reason: "subscription_cycle",
      amount_paid: 11900,
      amount_due: 11900,
      currency: "usd",
      attempt_count: 1,
      parent: { subscription_details: { subscription: "sub_1", metadata: { order_id: "order-1" } } },
      lines: { data: [{ period: { start: 1_800_000_000, end: 1_831_536_000 } }] },
    });
    expect(e).toMatchObject({ type: "subscription.invoice_paid", subscriptionId: "sub_1", invoiceId: "in_1", amountCents: 11900, billingReason: "subscription_cycle", orderId: "order-1" });
  });

  it("ignores invoices that don't belong to a subscription", () => {
    expect(deliver("invoice.paid", { id: "in_2", object: "invoice", amount_paid: 100, currency: "usd" }).type).toBe("ignored");
  });

  it("normalizes a failed renewal with its attempt count", () => {
    const e = deliver("invoice.payment_failed", {
      id: "in_3",
      object: "invoice",
      amount_due: 11900,
      amount_paid: 0,
      currency: "usd",
      attempt_count: 2,
      parent: { subscription_details: { subscription: "sub_1", metadata: {} } },
      lines: { data: [] },
    });
    expect(e).toMatchObject({ type: "subscription.invoice_failed", attemptCount: 2, amountCents: 11900 });
  });

  it("normalizes subscription updates and deletion, including a scheduled cancellation", () => {
    expect(
      deliver("customer.subscription.updated", { id: "sub_1", object: "subscription", status: "active", cancel_at_period_end: true, items: { data: [] }, metadata: {} }),
    ).toMatchObject({ type: "subscription.updated", subscriptionStatus: "active", cancelAtPeriodEnd: true });
    expect(deliver("customer.subscription.deleted", { id: "sub_1", object: "subscription", status: "canceled", items: { data: [] }, metadata: {} })).toMatchObject({
      type: "subscription.deleted",
      subscriptionStatus: "canceled",
    });
  });
});

describe("sandbox renewal simulator", () => {
  const sandbox = new SandboxPaymentProvider(process.env.SANDBOX_WEBHOOK_SECRET!);
  const deliver = (type: string, data: Record<string, unknown>) => {
    const { body, signature } = sandbox.buildSignedEvent(type, data);
    return sandbox.parseWebhook(body, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signature }));
  };

  it("normalizes the same events as Stripe", () => {
    expect(deliver("invoice.paid", { subscription_id: "sbx_sub_1", invoice_id: "sbx_in_1", order_id: "o", amount_total: 11900, currency: "usd" })).toMatchObject({
      type: "subscription.invoice_paid",
      subscriptionId: "sbx_sub_1",
      billingReason: "subscription_cycle",
    });
    expect(deliver("customer.subscription.deleted", { subscription_id: "sbx_sub_1", order_id: "o" })).toMatchObject({ type: "subscription.deleted", subscriptionStatus: "canceled" });
  });

  it("carries the subscription id on a completed checkout", () => {
    expect(
      deliver("checkout.session.completed", {
        session_id: "sbx_cs_1",
        payment_intent: "sbx_pi_1",
        order_id: "o",
        payment_id: "p",
        amount_total: 12900,
        currency: "usd",
        subscription_id: "sbx_sub_1",
        invoice_id: "sbx_in_1",
      }),
    ).toMatchObject({ type: "checkout.completed", subscriptionId: "sbx_sub_1", invoiceId: "sbx_in_1" });
  });

  it("never reports a processing fee, so economics fall back to an estimate", async () => {
    expect(await sandbox.processingFeeCents()).toBeNull();
  });
});
