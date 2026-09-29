import { describe, expect, it } from "vitest";
import { SANDBOX_SIGNATURE_HEADER, SandboxPaymentProvider } from "@/lib/payments/sandbox";
import { signPayload } from "@/lib/payments/signature";
import { WebhookVerificationError } from "@/lib/payments/types";

// Only pure methods are exercised here (parseWebhook, buildSignedEvent); nothing touches the database.
const SECRET = process.env.SANDBOX_WEBHOOK_SECRET!;
const provider = new SandboxPaymentProvider(SECRET);

function headersFor(signature: string | null): Headers {
  const h = new Headers();
  if (signature !== null) h.set(SANDBOX_SIGNATURE_HEADER, signature);
  return h;
}

function deliver(type: string, data: Record<string, unknown>) {
  const { body, signature } = provider.buildSignedEvent(type, data);
  return provider.parseWebhook(body, headersFor(signature));
}

function signedRaw(event: unknown, secret = SECRET, ts?: number) {
  const body = typeof event === "string" ? event : JSON.stringify(event);
  return { body, signature: signPayload(body, secret, ts) };
}

describe("SandboxPaymentProvider.parseWebhook", () => {
  it("normalizes checkout.session.completed", () => {
    const e = deliver("checkout.session.completed", {
      session_id: "sbx_cs_abc",
      payment_intent: "sbx_pi_1",
      order_id: "order-1",
      payment_id: "payment-1",
      amount_total: 5600,
      currency: "usd",
    });
    expect(e).toMatchObject({
      provider: "sandbox",
      rawType: "checkout.session.completed",
      type: "checkout.completed",
      sessionId: "sbx_cs_abc",
      providerPaymentId: "sbx_pi_1",
      orderId: "order-1",
      internalPaymentId: "payment-1",
      amountCents: 5600,
      currency: "usd",
      receiptUrl: null,
    });
    expect(e.id).toMatch(/^sbx_evt_[0-9a-f]+$/);
    expect(e.createdAt).toBeInstanceOf(Date);
    expect(Math.abs(e.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it("normalizes payment_intent.payment_failed with a default reason", () => {
    const e = deliver("payment_intent.payment_failed", { session_id: "sbx_cs_abc", payment_id: "payment-1" });
    expect(e).toMatchObject({ type: "payment.failed", sessionId: "sbx_cs_abc", failureReason: "card_declined" });
    const e2 = deliver("payment_intent.payment_failed", { session_id: "s", failure_reason: "insufficient_funds" });
    expect(e2.failureReason).toBe("insufficient_funds");
  });

  it("normalizes checkout.session.expired", () => {
    const e = deliver("checkout.session.expired", { session_id: "sbx_cs_abc", payment_id: "payment-1" });
    expect(e).toMatchObject({ type: "checkout.expired", sessionId: "sbx_cs_abc", internalPaymentId: "payment-1" });
  });

  it("normalizes refund events", () => {
    const data = { refund_id: "sbx_re_1", internal_refund_id: "refund-1", payment_intent: "sbx_pi_1", amount: 700 };
    expect(deliver("refund.succeeded", data)).toMatchObject({
      type: "refund.succeeded",
      providerRefundId: "sbx_re_1",
      internalRefundId: "refund-1",
      providerPaymentId: "sbx_pi_1",
      amountCents: 700,
    });
    expect(deliver("refund.failed", data)).toMatchObject({ type: "refund.failed", internalRefundId: "refund-1" });
  });

  it("marks unknown event types as ignored", () => {
    expect(deliver("customer.created", {}).type).toBe("ignored");
  });

  it("uses the event's own timestamp", () => {
    const created = Math.floor(Date.now() / 1000) - 60;
    const { body, signature } = signedRaw({ id: "evt_x", type: "checkout.session.expired", created, data: {} });
    const e = provider.parseWebhook(body, headersFor(signature));
    expect(e.createdAt.getTime()).toBe(created * 1000);
    expect(e.id).toBe("evt_x");
  });

  it("rejects bad signatures", () => {
    const { body, signature } = provider.buildSignedEvent("checkout.session.completed", { amount_total: 5600 });
    expect(() => provider.parseWebhook(body, headersFor(null))).toThrow(WebhookVerificationError);
    expect(() => provider.parseWebhook(body.replace("5600", "1"), headersFor(signature))).toThrow(WebhookVerificationError);

    const wrongSecret = signedRaw(body, "not-the-sandbox-secret-000");
    expect(() => provider.parseWebhook(body, headersFor(wrongSecret.signature))).toThrow(WebhookVerificationError);

    const other = new SandboxPaymentProvider("a-different-secret-0123456789");
    expect(() => other.parseWebhook(body, headersFor(signature))).toThrow(/mismatch/);
  });

  it("rejects replayed (stale) deliveries", () => {
    const stale = signedRaw(
      { id: "evt_old", type: "checkout.session.completed", created: 1, data: {} },
      SECRET,
      Math.floor(Date.now() / 1000) - 3600,
    );
    expect(() => provider.parseWebhook(stale.body, headersFor(stale.signature))).toThrow(/tolerance/);
  });

  it("rejects correctly signed but invalid payloads", () => {
    const notJson = signedRaw("not json");
    expect(() => provider.parseWebhook(notJson.body, headersFor(notJson.signature))).toThrow(/invalid JSON/);
    const noId = signedRaw({ type: "checkout.session.completed", created: 1, data: {} });
    expect(() => provider.parseWebhook(noId.body, headersFor(noId.signature))).toThrow(/envelope/);
    const badCreated = signedRaw({ id: "evt", type: "x", created: "yesterday", data: {} });
    expect(() => provider.parseWebhook(badCreated.body, headersFor(badCreated.signature))).toThrow(/envelope/);
    const nullBody = signedRaw("null");
    expect(() => provider.parseWebhook(nullBody.body, headersFor(nullBody.signature))).toThrow(WebhookVerificationError);
  });
});
