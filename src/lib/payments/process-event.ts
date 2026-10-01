import "server-only";
import { isProductionEnvironment } from "@/config/site";
import { businessAttribution } from "@/lib/analytics/attribution-server";
import { trackServer } from "@/lib/analytics/server";
import { loadFilingContext } from "@/lib/filings/context";
import { formatCents } from "@/lib/domain/money";
import { sendNotification } from "@/lib/notifications/send";
import { notifyStaff } from "@/lib/notifications/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedPaymentEvent } from "./types";

export type ProcessOutcome =
  | { status: "processed"; result: string }
  | { status: "duplicate" }
  | { status: "ignored"; result: string };

/**
 * Provider-agnostic webhook processing.
 *  - Idempotent: payment_events(provider, provider_event_id) is unique; an event that
 *    was already processed returns "duplicate" without side effects.
 *  - Re-entrant: if processing failed midway, the provider's retry reprocesses it;
 *    every step below is itself idempotent (conditional SQL + notification dedupe).
 *  - Order-independent: the SQL functions never move a payment backwards.
 */
export async function processPaymentEvent(event: NormalizedPaymentEvent): Promise<ProcessOutcome> {
  const db = createAdminClient();

  const { error: insertError } = await db.from("payment_events").insert({
    provider: event.provider,
    provider_event_id: event.id,
    event_type: event.rawType,
    event_created_at: event.createdAt.toISOString(),
    payload: event.payload as object,
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error(`payment event insert failed: ${insertError.message}`);
  }

  const { data: row } = await db
    .from("payment_events")
    .select("id, processed_at, attempts")
    .eq("provider", event.provider)
    .eq("provider_event_id", event.id)
    .single();
  if (row?.processed_at) return { status: "duplicate" };

  try {
    const result = await handle(event);
    await db
      .from("payment_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_result: result,
        processing_error: null,
        attempts: (row?.attempts ?? 0) + 1,
      })
      .eq("id", row!.id);
    return result.startsWith("ignored") ? { status: "ignored", result } : { status: "processed", result };
  } catch (e) {
    await db
      .from("payment_events")
      .update({
        processing_error: e instanceof Error ? e.message.slice(0, 1000) : "unknown error",
        attempts: (row?.attempts ?? 0) + 1,
      })
      .eq("id", row!.id);
    throw e;
  }
}

async function findPayment(event: NormalizedPaymentEvent) {
  const db = createAdminClient();
  if (event.sessionId) {
    const { data } = await db
      .from("payments")
      .select("id, order_id, user_id, provider, status")
      .eq("provider", event.provider)
      .eq("provider_session_id", event.sessionId)
      .maybeSingle();
    if (data) {
      // Cross-check metadata when present: a session must belong to the payment it claims.
      if (event.internalPaymentId && event.internalPaymentId !== data.id) return null;
      return data;
    }
  }
  if (event.internalPaymentId) {
    const { data } = await db
      .from("payments")
      .select("id, order_id, user_id, provider, status")
      .eq("provider", event.provider)
      .eq("id", event.internalPaymentId)
      .maybeSingle();
    if (data) return data;
  }
  if (event.providerPaymentId) {
    const { data } = await db
      .from("payments")
      .select("id, order_id, user_id, provider, status")
      .eq("provider", event.provider)
      .eq("provider_payment_id", event.providerPaymentId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handle(event: NormalizedPaymentEvent): Promise<string> {
  const db = createAdminClient();

  switch (event.type) {
    case "checkout.completed": {
      const payment = await findPayment(event);
      if (!payment) return "ignored:unmatched_payment";
      const { data, error } = await db.rpc("apply_payment_success", {
        p_payment_id: payment.id,
        p_provider_payment_id: event.providerPaymentId ?? null,
        p_receipt_url: event.receiptUrl ?? null,
        p_amount_cents: event.amountCents ?? null,
        p_currency: event.currency ?? null,
        p_event_at: event.createdAt.toISOString(),
      });
      if (error) throw new Error(`apply_payment_success: ${error.message}`);
      const res = data as { applied: boolean; reason?: string; filing_id?: string; order_id?: string };
      if (!res.applied) return `ignored:${res.reason ?? "not_applied"}`;
      await afterPaymentSucceeded(res.filing_id ?? null, res.order_id ?? payment.order_id, payment.user_id);
      return "payment_succeeded";
    }

    case "payment.failed":
    case "checkout.expired": {
      const payment = await findPayment(event);
      if (!payment) return "ignored:unmatched_payment";
      const status = event.type === "payment.failed" ? "failed" : "expired";
      const { data, error } = await db.rpc("apply_payment_failure", {
        p_payment_id: payment.id,
        p_status: status,
        p_reason: event.failureReason ?? status,
        p_event_at: event.createdAt.toISOString(),
      });
      if (error) throw new Error(`apply_payment_failure: ${error.message}`);
      const res = data as { applied: boolean; reason?: string };
      if (!res.applied) return `ignored:${res.reason ?? "not_applied"}`;
      if (status === "failed") {
        const { data: filing } = await db.from("filings").select("id").eq("order_id", payment.order_id).maybeSingle();
        const ctx = filing ? await loadFilingContext(filing.id) : null;
        if (ctx) {
          await sendNotification({
            userId: payment.user_id,
            templateKey: "payment_failed",
            dedupeKey: `payment_failed:${payment.id}`,
            vars: ctx.vars,
            ctaPath: `/file/${ctx.filing.id}/checkout`,
            filingId: ctx.filing.id,
            businessId: ctx.filing.businessId,
          });
        }
      }
      return `payment_${status}`;
    }

    case "refund.succeeded":
    case "refund.failed": {
      let refundId = event.internalRefundId ?? null;
      if (!refundId && event.providerRefundId) {
        const { data } = await db.from("refunds").select("id").eq("provider_refund_id", event.providerRefundId).maybeSingle();
        refundId = data?.id ?? null;
      }
      if (!refundId) {
        // A refund we didn't initiate (e.g. issued in the processor dashboard): flag for review.
        const payment = await findPayment(event);
        if (payment) {
          await db
            .from("payments")
            .update({ requires_review: true, review_reason: "refund issued outside the app, reconcile it" })
            .eq("id", payment.id);
        }
        return "ignored:unmatched_refund";
      }
      const status = event.type === "refund.succeeded" ? "succeeded" : "failed";
      const { data, error } = await db.rpc("apply_refund_result", {
        p_refund_id: refundId,
        p_status: status,
        p_provider_refund_id: event.providerRefundId ?? null,
      });
      if (error) throw new Error(`apply_refund_result: ${error.message}`);
      const res = data as { applied: boolean; reason?: string };
      if (res.applied && status === "succeeded") await afterRefundSucceeded(refundId);
      return res.applied ? `refund_${status}` : `ignored:${res.reason ?? "not_applied"}`;
    }

    case "ignored":
      return `ignored:${event.rawType}`;
  }
}

export async function afterPaymentSucceeded(filingId: string | null, orderId: string, userId: string) {
  const ctx = filingId ? await loadFilingContext(filingId) : null;
  if (!ctx) return;
  const { data: order, error: orderError } = await createAdminClient()
    .from("orders")
    .select("government_fee_cents, service_fee_cents, total_cents, payment_mode")
    .eq("id", orderId)
    .single();
  if (orderError || !order) throw new Error(`order lookup failed: ${orderError?.message ?? "not found"}`);
  // The state's fee and our service fee are always shown as separate lines.
  const feeVars = {
    government_fee: formatCents(order.government_fee_cents),
    service_fee: formatCents(order.service_fee_cents),
    amount: formatCents(order.total_cents),
  };
  await sendNotification({
    userId,
    templateKey: "order_confirmed",
    dedupeKey: `order_confirmed:${orderId}`,
    vars: { ...ctx.vars, ...feeVars },
    ctaPath: `/dashboard/filings/${ctx.filing.id}`,
    filingId: ctx.filing.id,
    businessId: ctx.filing.businessId,
    // Production never tells a customer a test-mode payment was received (no money moved).
    suppressReason: isProductionEnvironment() && order.payment_mode !== "live" ? "test-mode payment (no real charge)" : null,
  });
  // Staff alert; notifyStaff never throws, so it cannot break payment processing.
  await notifyStaff({
    templateKey: "staff_new_paid_order",
    vars: { ...ctx.vars, ...feeVars, payment_mode: order.payment_mode },
    dedupeKey: `staff_new_paid_order:${orderId}`,
    ctaPath: `/admin/filings/${ctx.filing.id}`,
    filingId: ctx.filing.id,
    businessId: ctx.filing.businessId,
  });
  await trackServer("payment_completed", {
    userId,
    stateCode: ctx.filing.stateCode,
    filingTypeCode: "annual_report",
    properties: { order_id: orderId, payment_mode: order.payment_mode },
    dedupeKey: `payment_completed:${orderId}`,
    // Webhooks have no visitor cookie: use what was captured when the business was added.
    attribution: await businessAttribution(ctx.filing.businessId),
  });
}

export async function afterRefundSucceeded(refundId: string) {
  const db = createAdminClient();
  const { data: refund } = await db
    .from("refunds")
    .select("id, order_id, user_id, amount_cents, government_fee_cents, service_fee_cents")
    .eq("id", refundId)
    .maybeSingle();
  if (!refund) return;
  const { data: filing } = await db.from("filings").select("id").eq("order_id", refund.order_id).maybeSingle();
  const ctx = filing ? await loadFilingContext(filing.id) : null;
  if (!ctx) return;
  await sendNotification({
    userId: refund.user_id,
    templateKey: "refund_issued",
    dedupeKey: `refund_issued:${refund.id}`,
    vars: {
      ...ctx.vars,
      amount: formatCents(refund.amount_cents),
      government_fee: formatCents(refund.government_fee_cents),
      service_fee: formatCents(refund.service_fee_cents),
    },
    ctaPath: `/dashboard/filings/${ctx.filing.id}`,
    filingId: ctx.filing.id,
    businessId: ctx.filing.businessId,
  });
}
