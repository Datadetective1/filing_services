import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { checkoutDescription, checkoutLineItemName } from "@/lib/payments/checkout-text";
import { CHECKOUT_PAYMENT_METHOD_TYPES, StripePaymentProvider } from "@/lib/payments/stripe";

// Fake, non-secret values. Only signature verification and normalization run: no network.
const KEY = "sk_test_unit_000000000000000000000000";
const WEBHOOK = "whsec_unit_0000000000000000";
const provider = new StripePaymentProvider(KEY, WEBHOOK, false);
const stripe = new Stripe(KEY);

function deliver(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${type.replace(/\W/g, "_")}`, object: "event", type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK });
  return provider.parseWebhook(payload, new Headers({ "stripe-signature": header }));
}

describe("StripePaymentProvider.parseWebhook", () => {
  it("ignores payment_intent.payment_failed, so a declined card in hosted Checkout can be retried", () => {
    const e = deliver("payment_intent.payment_failed", {
      id: "pi_1",
      object: "payment_intent",
      metadata: { order_id: "order-1", payment_id: "payment-1" },
      last_payment_error: { code: "card_declined" },
    });
    expect(e.type).toBe("ignored");
    expect(e.rawType).toBe("payment_intent.payment_failed");
  });

  it("still treats checkout.session.async_payment_failed as a final failure", () => {
    const e = deliver("checkout.session.async_payment_failed", { id: "cs_1", object: "checkout.session", metadata: { order_id: "order-1", payment_id: "payment-1" } });
    expect(e).toMatchObject({ type: "payment.failed", sessionId: "cs_1", orderId: "order-1", internalPaymentId: "payment-1" });
  });

  it("still normalizes checkout.session.expired and a paid checkout.session.completed", () => {
    expect(deliver("checkout.session.expired", { id: "cs_2", object: "checkout.session", metadata: { payment_id: "payment-2" } })).toMatchObject({
      type: "checkout.expired",
      sessionId: "cs_2",
      internalPaymentId: "payment-2",
    });
    expect(
      deliver("checkout.session.completed", {
        id: "cs_3",
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: "pi_3",
        amount_total: 5600,
        currency: "usd",
        metadata: { order_id: "order-3", payment_id: "payment-3" },
      }),
    ).toMatchObject({ type: "checkout.completed", providerPaymentId: "pi_3", amountCents: 5600 });
  });

  it("rejects a bad signature", () => {
    expect(() => provider.parseWebhook("{}", new Headers({ "stripe-signature": "t=1,v1=00" }))).toThrow(/signature|timestamp/i);
  });
});

describe("checkout wording sent to the processor", () => {
  it("names the state fee as a pass-through and the service fee with the brand", () => {
    expect(checkoutLineItemName("government_fee", "Pennsylvania Department of State")).toBe(
      "Pennsylvania Department of State filing fee (passed through at cost)",
    );
    expect(checkoutLineItemName("service_fee", "Pennsylvania Department of State")).toBe(`${site.name} service fee`);
    expect(checkoutLineItemName("service_fee", "x").toLowerCase()).not.toMatch(/government|state/);
  });

  it("puts the brand first in the payment description so it never reads like a state charge", () => {
    const d = checkoutDescription({ stateName: "Pennsylvania", filingName: "Annual Report", businessName: "Acme LLC" });
    expect(d).toBe(`${site.name} filing service: Pennsylvania Annual Report, Acme LLC`);
    expect(checkoutDescription({ stateName: "Pennsylvania", filingName: "Annual Report", businessName: " " })).toBe(
      `${site.name} filing service: Pennsylvania Annual Report`,
    );
    expect(checkoutDescription({ stateName: "Pennsylvania", filingName: "Annual Report", businessName: "A".repeat(400) })).toHaveLength(200);
  });
});

describe("Checkout payment methods", () => {
  it("offers only instant-settling methods: cards (incl. Apple Pay / Google Pay) and Link", () => {
    expect([...CHECKOUT_PAYMENT_METHOD_TYPES]).toEqual(["card", "link"]);
  });
});
