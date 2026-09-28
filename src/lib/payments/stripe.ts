import "server-only";
import Stripe from "stripe";
import {
  type CheckoutSession,
  type CreateCheckoutInput,
  type NormalizedPaymentEvent,
  type PaymentMode,
  type PaymentProvider,
  PaymentConfigurationError,
  type RefundInput,
  type RefundResult,
  type SessionStatus,
  WebhookVerificationError,
} from "./types";

/**
 * Stripe adapter (hosted Checkout — we never see or store card data).
 * Constructing it with a live key throws unless PAYMENTS_LIVE_ENABLED=true.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly mode: PaymentMode;
  private readonly stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
    liveEnabled: boolean,
  ) {
    const isLive = /^(sk|rk)_live_/.test(secretKey);
    const isTest = /^(sk|rk)_test_/.test(secretKey);
    if (!isLive && !isTest) throw new PaymentConfigurationError("Unrecognized Stripe key format");
    if (isLive && !liveEnabled) {
      throw new PaymentConfigurationError(
        "Live Stripe key present but PAYMENTS_LIVE_ENABLED is not 'true'. Refusing to start live payments.",
      );
    }
    this.mode = isLive ? "live" : "test";
    this.stripe = new Stripe(secretKey, { maxNetworkRetries: 2, appInfo: { name: "filewell" } });
  }

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    if (input.totalCents < 50) throw new PaymentConfigurationError("Stripe requires a total of at least $0.50");
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.customerEmail,
        client_reference_id: input.orderId,
        line_items: input.lineItems
          .filter((li) => li.amountCents > 0)
          .map((li) => ({
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: li.amountCents,
              product_data: { name: li.name },
            },
          })),
        metadata: { order_id: input.orderId, payment_id: input.paymentId },
        payment_intent_data: {
          description: input.description,
          metadata: { order_id: input.orderId, payment_id: input.paymentId },
        },
        success_url: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: input.cancelUrl,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { sessionId: session.id, url: session.url };
  }

  async retrieveSession(sessionId: string): Promise<SessionStatus | null> {
    try {
      const s = await this.stripe.checkout.sessions.retrieve(sessionId);
      return {
        sessionId: s.id,
        status: s.status === "complete" ? "complete" : s.status === "expired" ? "expired" : "open",
        paid: s.payment_status === "paid",
        amountCents: s.amount_total,
        currency: s.currency,
        providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
        orderId: s.metadata?.order_id ?? null,
        paymentId: s.metadata?.payment_id ?? null,
      };
    } catch {
      return null;
    }
  }

  async expireSession(sessionId: string): Promise<void> {
    try {
      await this.stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Already completed or expired.
    }
  }

  parseWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent {
    const signature = headers.get("stripe-signature");
    if (!signature) throw new WebhookVerificationError("missing stripe-signature header");
    let evt: Stripe.Event;
    try {
      evt = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (e) {
      throw new WebhookVerificationError(e instanceof Error ? e.message : "invalid signature");
    }
    const base = {
      provider: "stripe" as const,
      id: evt.id,
      rawType: evt.type,
      createdAt: new Date(evt.created * 1000),
      payload: { id: evt.id, type: evt.type, created: evt.created, livemode: evt.livemode },
    };

    switch (evt.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const s = evt.data.object;
        if (s.payment_status !== "paid") return { ...base, type: "ignored" };
        return {
          ...base,
          type: "checkout.completed",
          sessionId: s.id,
          providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
          orderId: s.metadata?.order_id ?? null,
          internalPaymentId: s.metadata?.payment_id ?? null,
          amountCents: s.amount_total,
          currency: s.currency,
          receiptUrl: null,
        };
      }
      case "checkout.session.async_payment_failed": {
        const s = evt.data.object;
        return {
          ...base,
          type: "payment.failed",
          sessionId: s.id,
          orderId: s.metadata?.order_id ?? null,
          internalPaymentId: s.metadata?.payment_id ?? null,
          failureReason: "async_payment_failed",
        };
      }
      case "checkout.session.expired": {
        const s = evt.data.object;
        return { ...base, type: "checkout.expired", sessionId: s.id, internalPaymentId: s.metadata?.payment_id ?? null };
      }
      case "payment_intent.payment_failed": {
        const pi = evt.data.object;
        return {
          ...base,
          type: "payment.failed",
          providerPaymentId: pi.id,
          orderId: pi.metadata?.order_id ?? null,
          internalPaymentId: pi.metadata?.payment_id ?? null,
          failureReason: pi.last_payment_error?.code ?? pi.last_payment_error?.message ?? "payment_failed",
        };
      }
      case "refund.created":
      case "refund.updated": {
        const r = evt.data.object;
        const common = {
          providerRefundId: r.id,
          internalRefundId: r.metadata?.internal_refund_id ?? null,
          providerPaymentId: typeof r.payment_intent === "string" ? r.payment_intent : (r.payment_intent?.id ?? null),
          amountCents: r.amount,
        };
        if (r.status === "succeeded") return { ...base, ...common, type: "refund.succeeded" };
        if (r.status === "failed" || r.status === "canceled") return { ...base, ...common, type: "refund.failed" };
        return { ...base, type: "ignored" };
      }
      default:
        return { ...base, type: "ignored" };
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const r = await this.stripe.refunds.create(
      {
        payment_intent: input.providerPaymentId,
        amount: input.amountCents,
        reason: "requested_by_customer",
        metadata: { internal_refund_id: input.internalRefundId, note: input.reason.slice(0, 450) },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return {
      providerRefundId: r.id,
      status: r.status === "succeeded" ? "succeeded" : r.status === "failed" || r.status === "canceled" ? "failed" : "pending",
    };
  }

  async receiptUrl(providerPaymentId: string): Promise<string | null> {
    try {
      const pi = await this.stripe.paymentIntents.retrieve(providerPaymentId, { expand: ["latest_charge"] });
      const charge = pi.latest_charge;
      return charge && typeof charge !== "string" ? (charge.receipt_url ?? null) : null;
    } catch {
      return null;
    }
  }
}
