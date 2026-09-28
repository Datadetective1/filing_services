import "server-only";
import { randomBytes } from "node:crypto";
import { absoluteUrl } from "@/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { signPayload, verifySignature } from "./signature";
import {
  type CheckoutSession,
  type CreateCheckoutInput,
  type NormalizedPaymentEvent,
  type PaymentProvider,
  type RefundResult,
  type SessionStatus,
  WebhookVerificationError,
} from "./types";

/**
 * Sandbox payment provider: a self-contained hosted-checkout simulator for
 * development, tests and staging. It moves NO money and makes NO network calls
 * to any payment processor. It deliberately mirrors Stripe's shape — hosted page,
 * signed webhooks, idempotent processing — so the whole payment path is exercised.
 */

export const SANDBOX_SIGNATURE_HEADER = "sandbox-signature";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox" as const;
  readonly mode = "sandbox" as const;

  constructor(private readonly webhookSecret: string) {}

  async createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const db = createAdminClient();
    // Idempotency: one session per internal payment id.
    const { data: existing } = await db
      .from("sandbox_checkout_sessions")
      .select("id")
      .eq("payment_id", input.paymentId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return { sessionId: existing.id, url: absoluteUrl(`/sandbox/checkout/${existing.id}`) };

    const sessionId = `sbx_cs_${randomBytes(16).toString("hex")}`;
    const { error } = await db.from("sandbox_checkout_sessions").insert({
      id: sessionId,
      order_id: input.orderId,
      payment_id: input.paymentId,
      amount_cents: input.totalCents,
      currency: input.currency,
      line_items: input.lineItems,
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (error) throw new Error(`sandbox session create failed: ${error.message}`);
    return { sessionId, url: absoluteUrl(`/sandbox/checkout/${sessionId}`) };
  }

  async retrieveSession(sessionId: string): Promise<SessionStatus | null> {
    const { data } = await createAdminClient()
      .from("sandbox_checkout_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (!data) return null;
    return {
      sessionId: data.id,
      status: data.status === "completed" ? "complete" : data.status === "open" ? "open" : "expired",
      paid: data.status === "completed",
      amountCents: data.amount_cents,
      currency: data.currency,
      providerPaymentId: data.payment_intent_id,
      orderId: data.order_id,
      paymentId: data.payment_id,
    };
  }

  async expireSession(sessionId: string): Promise<void> {
    await createAdminClient()
      .from("sandbox_checkout_sessions")
      .update({ status: "expired" })
      .eq("id", sessionId)
      .eq("status", "open");
  }

  parseWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent {
    verifySignature(rawBody, headers.get(SANDBOX_SIGNATURE_HEADER), this.webhookSecret);
    let evt: SandboxEvent;
    try {
      evt = JSON.parse(rawBody) as SandboxEvent;
    } catch {
      throw new WebhookVerificationError("invalid JSON");
    }
    if (typeof evt?.id !== "string" || typeof evt?.type !== "string" || typeof evt?.created !== "number") {
      throw new WebhookVerificationError("invalid event envelope");
    }
    const o = evt.data ?? {};
    const base = {
      provider: "sandbox" as const,
      id: evt.id,
      rawType: evt.type,
      createdAt: new Date(evt.created * 1000),
      payload: evt,
    };
    switch (evt.type) {
      case "checkout.session.completed":
        return {
          ...base,
          type: "checkout.completed",
          sessionId: o.session_id,
          providerPaymentId: o.payment_intent,
          orderId: o.order_id,
          internalPaymentId: o.payment_id,
          amountCents: o.amount_total,
          currency: o.currency,
          receiptUrl: null,
        };
      case "payment_intent.payment_failed":
        return {
          ...base,
          type: "payment.failed",
          sessionId: o.session_id,
          orderId: o.order_id,
          internalPaymentId: o.payment_id,
          failureReason: o.failure_reason ?? "card_declined",
        };
      case "checkout.session.expired":
        return { ...base, type: "checkout.expired", sessionId: o.session_id, internalPaymentId: o.payment_id };
      case "refund.succeeded":
      case "refund.failed":
        return {
          ...base,
          type: evt.type,
          providerRefundId: o.refund_id,
          internalRefundId: o.internal_refund_id,
          providerPaymentId: o.payment_intent,
          amountCents: o.amount,
        };
      default:
        return { ...base, type: "ignored" };
    }
  }

  async refund(): Promise<RefundResult> {
    // Sandbox refunds succeed immediately; a signed refund webhook is also produced
    // by the caller in tests to exercise duplicate-delivery handling.
    return { providerRefundId: id("sbx_re"), status: "succeeded" };
  }

  /** Build a signed event exactly as the hosted sandbox page would deliver it. */
  buildSignedEvent(type: string, data: Record<string, unknown>): { body: string; signature: string } {
    const evt: SandboxEvent = { id: id("sbx_evt"), type, created: Math.floor(Date.now() / 1000), data };
    const body = JSON.stringify(evt);
    return { body, signature: signPayload(body, this.webhookSecret) };
  }
}

interface SandboxEvent {
  id: string;
  type: string;
  created: number;
  data: {
    session_id?: string;
    payment_intent?: string;
    order_id?: string;
    payment_id?: string;
    amount_total?: number;
    amount?: number;
    currency?: string;
    failure_reason?: string;
    refund_id?: string;
    internal_refund_id?: string;
  };
}
