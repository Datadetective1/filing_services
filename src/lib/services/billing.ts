import "server-only";
import { isProductionEnvironment } from "@/config/site";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import { formatCents } from "@/lib/domain/money";
import { sendNotification } from "@/lib/notifications/send";
import { notifyStaff } from "@/lib/notifications/staff";
import { getPaymentProvider } from "@/lib/payments";
import type { NormalizedPaymentEvent } from "@/lib/payments/types";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { billingAction, billingStatusFromStripe, type BillingStatus } from "@/lib/registered-agent/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { addOneYear, includedRequirement, type RequirementLike } from "./bundle";
import { SERVICES, STANDARD_PRICE_VARIANT, isServiceCode, type ServiceCode } from "./catalog";
import { allocateProcessingFee, economicsFromLines, estimateProcessingFeeCents, type OrderEconomicsDraft } from "./economics";

/**
 * Business services billing, driven by payment webhooks. Every handler is idempotent:
 * webhook events are deduplicated upstream (payment_events), renewal orders are keyed by
 * the processor's invoice id (payments.provider_invoice_id is unique), and status changes
 * are conditional updates.
 *
 * Billing and the legal appointment are separate. Nothing here makes service active (an
 * operator does that with the provider's confirmation), and nothing here ends it: a failed
 * or cancelled subscription is reported to the customer and to staff, never sent to the
 * provider or the state automatically.
 */

interface SubRow {
  id: string;
  user_id: string;
  business_id: string;
  state_code: string;
  plan: "registered_agent" | "ra_annual_report_bundle";
  order_id: string | null;
  billing_status: BillingStatus;
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  failed_payment_count: number;
  renewal_price_cents: number;
}

const SUB_COLUMNS =
  "id, user_id, business_id, state_code, plan, order_id, billing_status, provider_subscription_id, current_period_start, current_period_end, failed_payment_count, renewal_price_cents";

async function findSubscription(event: { subscriptionId?: string | null; orderId?: string | null }): Promise<SubRow | null> {
  const db = createAdminClient();
  if (event.subscriptionId) {
    const { data } = await db.from("ra_subscriptions").select(SUB_COLUMNS).eq("provider_subscription_id", event.subscriptionId).maybeSingle();
    if (data) return data as SubRow;
  }
  if (event.orderId && /^[0-9a-f-]{36}$/i.test(event.orderId)) {
    const { data } = await db.from("ra_subscriptions").select(SUB_COLUMNS).eq("order_id", event.orderId).maybeSingle();
    // Never re-point a subscription that is already linked to a different processor subscription.
    if (data && (!data.provider_subscription_id || !event.subscriptionId || data.provider_subscription_id === event.subscriptionId)) return data as SubRow;
  }
  return null;
}

async function names(sub: Pick<SubRow, "business_id" | "state_code" | "plan">) {
  const { data: business } = await createAdminClient().from("businesses").select("legal_name").eq("id", sub.business_id).maybeSingle();
  return {
    company_name: (business?.legal_name as string | undefined) ?? "your business",
    state_name: getRaJurisdiction(sub.state_code)?.name ?? sub.state_code,
    service_name: SERVICES[sub.plan].name.toLowerCase(),
  };
}

/** Actual processing fee when the processor reports it; otherwise an estimate, flagged. */
async function processingFee(ref: { paymentIntentId?: string | null; invoiceId?: string | null }, chargeCents: number) {
  try {
    const actual = await getPaymentProvider().processingFeeCents(ref);
    if (actual !== null) return { cents: actual, source: "actual" as const };
  } catch (e) {
    console.error("[billing] processing fee lookup failed", e instanceof Error ? e.message : e);
  }
  return { cents: estimateProcessingFeeCents(chargeCents), source: "estimated" as const };
}

async function recordEconomics(orderId: string, drafts: OrderEconomicsDraft[], fee: { cents: number; source: "actual" | "estimated" }, variant: string) {
  const parts = allocateProcessingFee(drafts, fee.cents);
  const rows = drafts.map((d, i) => ({
    order_id: orderId,
    service_code: d.serviceCode,
    fulfillment_method: d.fulfillmentMethod,
    service_revenue_cents: d.serviceRevenueCents,
    government_fees_collected_cents: d.governmentFeesCollectedCents,
    wholesale_cost_cents: d.wholesaleCostCents,
    acquisition_cost_cents: d.acquisitionCostCents,
    processing_fee_cents: parts[i],
    processing_fee_source: fee.source,
    price_variant: variant,
  }));
  // Upsert on (order_id, service_code): a retried webhook rewrites the same rows.
  const { error } = await createAdminClient().from("order_economics").upsert(rows, { onConflict: "order_id,service_code" });
  if (error) throw new Error(`order_economics: ${error.message}`);
}

/**
 * After a business services checkout is paid (webhook or verified return). Links the
 * processor subscription, marks billing active, moves provider orders to "payment
 * confirmed" (never further), records economics and tells the customer and staff.
 */
export async function afterServiceOrderPaid(input: {
  orderId: string;
  subscriptionId: string | null;
  invoiceId: string | null;
  providerPaymentId: string | null;
}): Promise<void> {
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, user_id, business_id, order_type, status, government_fee_cents, service_fee_cents, total_cents, payment_mode, pricing_snapshot")
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order || order.order_type !== "business_services" || order.status !== "paid") return;
  const snapshot = (order.pricing_snapshot ?? {}) as {
    service?: string;
    state_code?: string;
    state_name?: string;
    price_variant?: string;
    quote?: { lines?: { kind: "service_fee" | "government_fee"; serviceCode: string; amountCents: number }[] };
  };

  // Link the payment to the processor's subscription and first invoice.
  if (input.subscriptionId || input.invoiceId) {
    await db
      .from("payments")
      .update({ provider_subscription_id: input.subscriptionId, provider_invoice_id: input.invoiceId })
      .eq("order_id", order.id)
      .eq("status", "succeeded")
      .is("provider_invoice_id", null);
  }

  const { data: sub } = await db.from("ra_subscriptions").select(SUB_COLUMNS).eq("order_id", order.id).maybeSingle();
  if (sub) {
    const start = sub.current_period_start ?? new Date().toISOString();
    await db
      .from("ra_subscriptions")
      .update({
        provider_subscription_id: sub.provider_subscription_id ?? input.subscriptionId,
        billing_status: sub.billing_status === "pending" || sub.billing_status === "incomplete" ? "active" : sub.billing_status,
        // The processor's invoice and subscription events overwrite these with its own dates.
        current_period_start: start,
        current_period_end: sub.current_period_end ?? `${addOneYear(start.slice(0, 10))}T00:00:00Z`,
      })
      .eq("id", sub.id);
  }

  const { data: providerOrders } = await db.from("provider_orders").select("id, status").eq("order_id", order.id);
  for (const po of providerOrders ?? []) {
    if (po.status !== "new_order") continue;
    const { error } = await db.rpc("transition_provider_order", {
      p_id: po.id,
      p_to_status: "payment_confirmed",
      p_actor_user_id: null,
      p_actor_type: "webhook",
      p_note: "Payment received",
      p_customer_visible: true,
      p_patch: {},
      p_expected_from: "new_order",
    });
    // A concurrent delivery may have moved it already; anything else is a real error.
    if (error && !/expected new_order/.test(error.message)) throw new Error(`transition_provider_order: ${error.message}`);
  }

  const lines = (snapshot.quote?.lines ?? []).filter((l): l is { kind: "service_fee" | "government_fee"; serviceCode: ServiceCode; amountCents: number } =>
    isServiceCode(l.serviceCode),
  );
  const fee = await processingFee({ paymentIntentId: input.providerPaymentId, invoiceId: input.invoiceId }, order.total_cents);
  await recordEconomics(order.id, economicsFromLines(lines), fee, snapshot.price_variant ?? STANDARD_PRICE_VARIANT);
  await db.from("payments").update({ processing_fee_cents: fee.source === "actual" ? fee.cents : null }).eq("order_id", order.id).eq("status", "succeeded");

  const service = isServiceCode(snapshot.service) ? snapshot.service : "registered_agent";
  const { data: business } = await db.from("businesses").select("legal_name").eq("id", order.business_id).maybeSingle();
  const vars = {
    company_name: (business?.legal_name as string | undefined) ?? "your business",
    state_name: snapshot.state_name ?? snapshot.state_code ?? "",
    service_name: SERVICES[service].name.toLowerCase(),
    government_fee: formatCents(order.government_fee_cents),
    service_fee: formatCents(order.service_fee_cents),
    amount: formatCents(order.total_cents),
    payment_mode: order.payment_mode,
    order_ref: order.id.slice(0, 8),
  };
  await sendNotification({
    userId: order.user_id,
    templateKey: "service_order_confirmed",
    dedupeKey: `service_order_confirmed:${order.id}`,
    vars,
    ctaPath: sub ? `/dashboard/services/${sub.id}` : "/dashboard",
    businessId: order.business_id,
    suppressReason: isProductionEnvironment() && order.payment_mode !== "live" ? "test-mode payment (no real charge)" : null,
  });
  await notifyStaff({
    templateKey: "staff_new_service_order",
    vars,
    dedupeKey: `staff_new_service_order:${order.id}`,
    ctaPath: sub ? `/admin/registered-agent/${sub.id}` : "/admin/registered-agent",
    businessId: order.business_id,
  });
  await trackServer("payment_completed", {
    userId: order.user_id,
    stateCode: snapshot.state_code ?? null,
    filingTypeCode: SERVICES[service].filingTypeCode,
    properties: { order_id: order.id, payment_mode: order.payment_mode, service_code: service, price_variant: snapshot.price_variant ?? STANDARD_PRICE_VARIANT },
    dedupeKey: `payment_completed:${order.id}`,
  });
}

/** Whether an order is a business services order (the annual report path ignores these). */
export async function isServiceOrder(orderId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("orders").select("order_type").eq("id", orderId).maybeSingle();
  return data?.order_type === "business_services";
}

async function openRequirements(businessId: string): Promise<RequirementLike[]> {
  const { data } = await createAdminClient()
    .from("filing_requirements")
    .select("id, period_year, due_date, status, compliance_rules!inner(filing_type_code)")
    .eq("business_id", businessId)
    .eq("compliance_rules.filing_type_code", "annual_report");
  return ((data ?? []) as { id: string; period_year: number; due_date: string; status: RequirementLike["status"] }[]).map((r) => ({
    id: r.id,
    periodYear: r.period_year,
    dueDate: r.due_date,
    status: r.status,
  }));
}

/** A paid subscription invoice: the first year (already handled at checkout) or a renewal. */
export async function handleInvoicePaid(event: NormalizedPaymentEvent): Promise<string> {
  const sub = await findSubscription(event);
  if (!sub) return "ignored:unknown_subscription";
  const db = createAdminClient();
  const periodPatch = {
    ...(event.periodStart ? { current_period_start: event.periodStart.toISOString() } : {}),
    ...(event.periodEnd ? { current_period_end: event.periodEnd.toISOString() } : {}),
  };

  if (event.billingReason !== "subscription_cycle") {
    // First invoice (or a one-off): the checkout handler creates the order; only sync dates.
    await db
      .from("ra_subscriptions")
      .update({ ...periodPatch, provider_subscription_id: sub.provider_subscription_id ?? event.subscriptionId ?? null })
      .eq("id", sub.id);
    return "subscription_first_invoice";
  }

  const amount = event.amountCents ?? 0;
  if (!event.invoiceId) return "ignored:renewal_without_invoice";
  // Idempotency: one renewal payment per processor invoice.
  const { data: seen } = await db.from("payments").select("id").eq("provider_invoice_id", event.invoiceId).maybeSingle();
  if (seen) return "ignored:renewal_already_recorded";

  const { data: lastPayment } = await db
    .from("payments")
    .select("provider, mode")
    .eq("order_id", sub.order_id ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mode = (lastPayment?.mode as string | undefined) ?? "sandbox";
  const providerName = (lastPayment?.provider as string | undefined) ?? event.provider;

  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      user_id: sub.user_id,
      business_id: sub.business_id,
      status: "paid",
      paid_at: event.createdAt.toISOString(),
      currency: "usd",
      order_type: "subscription_renewal",
      government_fee_cents: 0,
      service_fee_cents: amount,
      total_cents: amount,
      pricing_snapshot: {
        kind: "subscription_renewal",
        service: sub.plan,
        state_code: sub.state_code,
        ra_subscription_id: sub.id,
        price_variant: STANDARD_PRICE_VARIANT,
        invoice_id: event.invoiceId,
      },
      payment_mode: mode,
    })
    .select("id")
    .single();
  if (orderError || !order) throw new Error(`renewal order: ${orderError?.message}`);
  const description = `${SERVICES[sub.plan].name}, renewal`;
  await db.from("order_items").insert({ order_id: order.id, kind: "service_fee", description, amount_cents: amount, service_code: sub.plan, billing: "annual" });
  const { error: payError } = await db.from("payments").insert({
    order_id: order.id,
    user_id: sub.user_id,
    provider: providerName,
    mode,
    purpose: "renewal",
    status: "succeeded",
    amount_cents: amount,
    currency: event.currency ?? "usd",
    provider_payment_id: event.providerPaymentId ?? null,
    provider_subscription_id: event.subscriptionId ?? sub.provider_subscription_id,
    provider_invoice_id: event.invoiceId,
    last_event_at: event.createdAt.toISOString(),
  });
  if (payError) {
    if (payError.code === "23505") {
      // A concurrent delivery recorded it first: drop our duplicate order.
      await db.from("order_items").delete().eq("order_id", order.id);
      await db.from("orders").delete().eq("id", order.id);
      return "ignored:renewal_already_recorded";
    }
    throw new Error(`renewal payment: ${payError.message}`);
  }

  const fee = await processingFee({ invoiceId: event.invoiceId }, amount);
  await recordEconomics(
    order.id,
    economicsFromLines([{ kind: "service_fee", serviceCode: sub.plan, amountCents: amount }]),
    fee,
    STANDARD_PRICE_VARIANT,
  );

  await db
    .from("ra_subscriptions")
    .update({ ...periodPatch, billing_status: "active", failed_payment_count: 0 })
    .eq("id", sub.id);

  // Bundle: the new year includes the next open report (never one already included).
  if (sub.plan === "ra_annual_report_bundle") {
    const start = (event.periodStart ?? event.createdAt).toISOString().slice(0, 10);
    const end = event.periodEnd ? event.periodEnd.toISOString().slice(0, 10) : addOneYear(start);
    const { data: used } = await db
      .from("bundle_filing_periods")
      .select("requirement_id")
      .eq("business_id", sub.business_id)
      .not("status", "in", "(not_included,superseded)");
    const usedIds = new Set((used ?? []).map((u) => u.requirement_id));
    const next = includedRequirement({ start, end }, (await openRequirements(sub.business_id)).filter((r) => !usedIds.has(r.id)));
    await db.from("bundle_filing_periods").upsert(
      {
        ra_subscription_id: sub.id,
        user_id: sub.user_id,
        business_id: sub.business_id,
        period_start: start,
        period_end: end,
        reporting_year: next?.periodYear ?? null,
        requirement_id: next?.id ?? null,
        status: next ? "scheduled" : "not_included",
        state_fee_collection: next ? "not_due" : "not_applicable",
      },
      { onConflict: "ra_subscription_id,period_start", ignoreDuplicates: true },
    );
    if (!next) {
      await notifyStaff({
        templateKey: "staff_ra_billing_review",
        vars: { ...(await names(sub)), message: "the bundle renewed but no annual report falls in the new year; check the customer's plan" },
        dedupeKey: `bundle_no_report:${sub.id}:${start}`,
        ctaPath: `/admin/registered-agent/${sub.id}`,
        businessId: sub.business_id,
      });
    }
  }

  await audit({
    actorUserId: null,
    actorType: "webhook",
    action: "ra_subscription.renewed",
    entityType: "ra_subscription",
    entityId: sub.id,
    after: { order_id: order.id, amount_cents: amount, invoice_id: event.invoiceId },
  });
  await trackServer("subscription_renewed", {
    userId: sub.user_id,
    stateCode: sub.state_code,
    filingTypeCode: SERVICES[sub.plan].filingTypeCode,
    properties: { ra_subscription_id: sub.id, service_code: sub.plan, order_id: order.id, amount_cents: amount },
    dedupeKey: `subscription_renewed:${event.invoiceId}`,
  });
  return "subscription_renewed";
}

/** A failed subscription invoice. The processor retries; service is never ended for it. */
export async function handleInvoiceFailed(event: NormalizedPaymentEvent): Promise<string> {
  const sub = await findSubscription(event);
  if (!sub) return "ignored:unknown_subscription";
  const db = createAdminClient();
  const attempts = Math.max(event.attemptCount ?? 0, sub.failed_payment_count + 1);
  const next: BillingStatus = sub.billing_status === "unpaid" ? "unpaid" : "past_due";
  await db.from("ra_subscriptions").update({ billing_status: next, failed_payment_count: attempts }).eq("id", sub.id);
  const action = billingAction({ previous: sub.billing_status, next, failedAttempts: attempts });
  const vars = await names(sub);
  if (action.kind === "notify_payment_failed") {
    await sendNotification({
      userId: sub.user_id,
      templateKey: "ra_payment_failed",
      dedupeKey: `ra_payment_failed:${event.invoiceId ?? sub.id}:${attempts}`,
      vars,
      ctaPath: `/dashboard/services/${sub.id}`,
      businessId: sub.business_id,
    });
    if (action.operatorReview) {
      await notifyStaff({
        templateKey: "staff_ra_billing_review",
        vars: { ...vars, message: `${attempts} failed renewal attempts` },
        dedupeKey: `ra_billing_review:${sub.id}:${event.invoiceId ?? "unknown"}`,
        ctaPath: `/admin/registered-agent/${sub.id}`,
        businessId: sub.business_id,
      });
    }
  }
  await audit({
    actorUserId: null,
    actorType: "webhook",
    action: "ra_subscription.payment_failed",
    entityType: "ra_subscription",
    entityId: sub.id,
    after: { attempts, invoice_id: event.invoiceId ?? null, billing_status: next },
  });
  return "subscription_payment_failed";
}

/** Subscription status, dates or cancel-at-period-end changed at the processor. */
export async function handleSubscriptionChanged(event: NormalizedPaymentEvent): Promise<string> {
  const sub = await findSubscription(event);
  if (!sub) return "ignored:unknown_subscription";
  const db = createAdminClient();
  const deleted = event.type === "subscription.deleted";
  const next: BillingStatus = deleted ? "canceled" : event.subscriptionStatus ? billingStatusFromStripe(event.subscriptionStatus) : sub.billing_status;
  // A checkout not yet confirmed by our own handler stays pending until it is.
  const status = sub.billing_status === "pending" && next === "active" ? "pending" : next;
  await db
    .from("ra_subscriptions")
    .update({
      billing_status: status,
      ...(typeof event.cancelAtPeriodEnd === "boolean" ? { cancel_at_period_end: event.cancelAtPeriodEnd } : {}),
      ...(event.periodStart ? { current_period_start: event.periodStart.toISOString() } : {}),
      ...(event.periodEnd ? { current_period_end: event.periodEnd.toISOString() } : {}),
    })
    .eq("id", sub.id);
  const action = billingAction({ previous: sub.billing_status, next: status, failedAttempts: sub.failed_payment_count });
  if (action.kind === "billing_ended_operator_review") {
    await notifyStaff({
      templateKey: "staff_ra_billing_review",
      vars: { ...(await names(sub)), message: "the subscription ended; confirm the customer's next agent before asking the provider to end service" },
      dedupeKey: `ra_billing_ended:${sub.id}`,
      ctaPath: `/admin/registered-agent/${sub.id}`,
      businessId: sub.business_id,
    });
    await trackServer("subscription_cancelled", {
      userId: sub.user_id,
      stateCode: sub.state_code,
      filingTypeCode: SERVICES[sub.plan].filingTypeCode,
      properties: { ra_subscription_id: sub.id, service_code: sub.plan, kind: "billing_ended" },
      dedupeKey: `subscription_cancelled:${sub.id}:ended`,
    });
  }
  await audit({
    actorUserId: null,
    actorType: "webhook",
    action: deleted ? "ra_subscription.billing_ended" : "ra_subscription.billing_updated",
    entityType: "ra_subscription",
    entityId: sub.id,
    before: { billing_status: sub.billing_status },
    after: { billing_status: status, cancel_at_period_end: event.cancelAtPeriodEnd ?? null },
  });
  return deleted ? "subscription_ended" : "subscription_updated";
}
