"use server";

import { randomBytes } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { processPaymentEvent } from "@/lib/payments/process-event";
import { SANDBOX_SIGNATURE_HEADER } from "@/lib/payments/sandbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { SANDBOX_SESSION_RE, loadOwnedSession, localPath, sandboxProvider } from "./session";

/** Re-authorize on every action: sandbox provider active, signed in, session owned by this user. */
async function authorize(sessionId: string) {
  const provider = sandboxProvider();
  if (!provider) notFound();
  if (typeof sessionId !== "string" || !SANDBOX_SESSION_RE.test(sessionId)) notFound();
  const user = await requireUser(`/sandbox/checkout/${sessionId}`);
  const session = await loadOwnedSession(user.id, sessionId);
  if (!session) notFound();
  return { provider, session };
}

function withSessionId(path: string, sessionId: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}session_id=${encodeURIComponent(sessionId)}`;
}

/**
 * "Pay (test)": deliver a signed checkout.session.completed event through the same
 * verification + processing path the webhook route uses, then return to the app.
 */
export async function payTest(sessionId: string): Promise<void> {
  const { provider, session } = await authorize(sessionId);
  const page = `/sandbox/checkout/${session.id}`;
  if (session.status !== "open") redirect(page);

  const paymentIntent = `sbx_pi_${randomBytes(12).toString("hex")}`;
  try {
    const { body, signature } = provider.buildSignedEvent("checkout.session.completed", {
      session_id: session.id,
      payment_intent: paymentIntent,
      order_id: session.order_id,
      payment_id: session.payment_id,
      amount_total: session.amount_cents,
      currency: session.currency,
    });
    const event = provider.parseWebhook(body, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signature }));
    await processPaymentEvent(event);
    await createAdminClient()
      .from("sandbox_checkout_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString(), payment_intent_id: paymentIntent })
      .eq("id", session.id)
      .eq("status", "open");
  } catch (e) {
    console.error("[sandbox] test payment failed", e);
    redirect(`${page}?error=1`);
  }
  redirect(withSessionId(localPath(session.success_url, "/dashboard"), session.id));
}

/** "Simulate a declined card": a signed payment_intent.payment_failed event. */
export async function declineTest(sessionId: string): Promise<void> {
  const { provider, session } = await authorize(sessionId);
  const page = `/sandbox/checkout/${session.id}`;
  if (session.status !== "open") redirect(page);

  try {
    const { body, signature } = provider.buildSignedEvent("payment_intent.payment_failed", {
      session_id: session.id,
      order_id: session.order_id,
      payment_id: session.payment_id,
      failure_reason: "card_declined",
    });
    const event = provider.parseWebhook(body, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signature }));
    await processPaymentEvent(event);
    await createAdminClient()
      .from("sandbox_checkout_sessions")
      .update({ status: "failed" })
      .eq("id", session.id)
      .eq("status", "open");
  } catch (e) {
    console.error("[sandbox] simulated decline failed", e);
    redirect(`${page}?error=1`);
  }
  redirect(localPath(session.cancel_url, "/dashboard"));
}

/** "Cancel": back to the app's cancel URL. The session stays open, like a real hosted checkout. */
export async function cancelTest(sessionId: string): Promise<void> {
  const { session } = await authorize(sessionId);
  redirect(localPath(session.cancel_url, "/dashboard"));
}
