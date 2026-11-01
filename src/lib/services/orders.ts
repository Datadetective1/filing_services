import "server-only";
import { absoluteUrl } from "@/config/site";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import type { SessionUser } from "@/lib/auth/session";
import { findRule } from "@/lib/compliance/registry";
import { formatCents } from "@/lib/domain/money";
import { governmentFeeFor, resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { getCurrentRuleVersion, listActivePricesAdmin } from "@/lib/filings/rules-db";
import { sendNotification } from "@/lib/notifications/send";
import { ensureRemindersForRequirement } from "@/lib/reminders/engine";
import { getPaymentProvider, requiresApprovedPrice } from "@/lib/payments";
import { changeOfAgentFeeCents, getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { bundleSaleCheck, raSaleCheck, type RaSituation, type SaleCheck } from "@/lib/registered-agent/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { afterServiceOrderPaid } from "./billing";
import { addOneYear, includedRequirement, overdueBeforeBundle, plannedBundleReport, type RequirementLike } from "./bundle";
import { SERVICES, STANDARD_PRICE_VARIANT, WHOLESALE } from "./catalog";
import { economicsFromLines } from "./economics";
import { bundleQuote, QuoteError, registeredAgentQuote, type PriceInput, type ServiceQuote } from "./quote";

/**
 * Business services orders: registered agent service and the registered agent + annual
 * report bundle. (Formation has its own checkout in ./formation.ts.)
 *
 * The flow mirrors the annual report checkout: server-side quote, sales checks that fail
 * closed, an order with separate service and government lines, a hosted checkout and an
 * idempotent webhook. Payment confirms the order and nothing more: service becomes active
 * only when an operator records the provider's confirmation.
 */

export class ServiceOrderError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "unavailable" | "invalid" | "not_allowed" = "invalid",
  ) {
    super(message);
  }
}

export const ORDERABLE_SERVICES = ["registered_agent", "ra_annual_report_bundle"] as const;
export type OrderableService = (typeof ORDERABLE_SERVICES)[number];

export function isOrderableService(v: unknown): v is OrderableService {
  return typeof v === "string" && (ORDERABLE_SERVICES as readonly string[]).includes(v);
}

export interface OwnedBusiness {
  id: string;
  legal_name: string;
  state_code: string;
  entity_type: EntityType;
  is_foreign: boolean;
  is_nonprofit: boolean;
  lifecycle: "existing" | "forming";
  formation_date: string | null;
}

/** A formed business already has an agent on the state record, so ordering for it is a switch. */
export function situationFor(business: Pick<OwnedBusiness, "lifecycle">): RaSituation {
  return business.lifecycle === "forming" ? "new_entity" : "switching";
}

export async function loadOwnedBusiness(userId: string, businessId: string): Promise<OwnedBusiness | null> {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) return null;
  const { data } = await createAdminClient()
    .from("businesses")
    .select("id, legal_name, state_code, entity_type, is_foreign, is_nonprofit, owner_user_id, archived_at, lifecycle, formation_date")
    .eq("id", businessId)
    .maybeSingle();
  if (!data || data.owner_user_id !== userId || data.archived_at) return null;
  return {
    id: data.id,
    legal_name: data.legal_name,
    state_code: data.state_code,
    entity_type: data.entity_type as EntityType,
    is_foreign: Boolean(data.is_foreign),
    is_nonprofit: Boolean(data.is_nonprofit),
    lifecycle: data.lifecycle === "forming" ? "forming" : "existing",
    formation_date: (data.formation_date as string | null) ?? null,
  };
}

function priceInput(p: ServicePrice | null, what: string): PriceInput {
  if (!p) throw new ServiceOrderError(`Pricing isn't set up for ${what} yet.`, "unavailable");
  return { id: p.id, serviceFeeCents: p.serviceFeeCents, approved: p.approved };
}

export interface ServiceOrderPreview {
  business: OwnedBusiness;
  service: OrderableService;
  situation: RaSituation;
  stateName: string;
  sale: SaleCheck;
  quote: ServiceQuote | null;
  /**
   * Bundle only: the bundle's first year and the report it includes. requirementId is null
   * when that report has no row yet (next year's report while this year's is still open);
   * checkout creates the row from ruleKey, periodYear and dueDate.
   */
  bundle: {
    periodStart: string;
    periodEnd: string;
    reportingYear: number;
    requirementId: string | null;
    ruleKey: string;
    dueDate: string;
    stateFeeCents: number;
  } | null;
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
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

/** Quote and availability for a business, without creating anything. */
export async function previewServiceOrder(
  u: SessionUser,
  input: { businessId: string; service: OrderableService },
  now = new Date(),
): Promise<ServiceOrderPreview> {
  const business = await loadOwnedBusiness(u.id, input.businessId);
  if (!business) throw new ServiceOrderError("Business not found", "not_found");
  const j = getRaJurisdiction(business.state_code);
  const stateName = j?.name ?? business.state_code;
  // Every formed business already names an agent, so ordering for it is a switch; only a
  // business still being formed names us in its formation filing. Never asked: derived.
  const situation = situationFor(business);
  const sale =
    input.service === "ra_annual_report_bundle"
      ? bundleSaleCheck(
          business.state_code,
          { entityType: business.entity_type, isForeign: business.is_foreign, isNonprofit: business.is_nonprofit },
          situation,
        )
      : raSaleCheck(business.state_code, business.entity_type, situation);
  const base: ServiceOrderPreview = { business, service: input.service, situation, stateName, sale, quote: null, bundle: null };
  if (!sale.ok) return base;

  const prices = await listActivePricesAdmin();
  const scope = { stateCode: business.state_code, entityType: business.entity_type, variant: STANDARD_PRICE_VARIANT };
  const changePrice =
    situation === "switching"
      ? priceInput(resolveServicePrice(prices, { filingTypeCode: SERVICES.change_registered_agent.filingTypeCode, ...scope }), "the change of agent filing")
      : undefined;
  const changeGovernmentFeeCents = situation === "switching" ? changeOfAgentFeeCents(business.state_code, business.entity_type) : undefined;

  try {
    if (input.service === "registered_agent") {
      const agentPrice = priceInput(resolveServicePrice(prices, { filingTypeCode: SERVICES.registered_agent.filingTypeCode, ...scope }), "registered agent service");
      return { ...base, quote: registeredAgentQuote({ stateName, situation, agentPrice, changePrice, changeGovernmentFeeCents }) };
    }
    const rule = findRule(business.state_code, business.entity_type, "annual_report", business.is_foreign);
    if (!rule) return { ...base, sale: { ok: false, reason: "We can't file this business's annual report, so the bundle isn't available." } };
    const periodStart = todayIso(now);
    const periodEnd = addOneYear(periodStart);
    const period = { start: periodStart, end: periodEnd };
    const requirements = await openRequirements(business.id);
    const existing = includedRequirement(period, requirements);
    const planned = existing ? null : plannedBundleReport(period, requirements, rule, business.formation_date);
    const included = existing
      ? { id: existing.id as string | null, periodYear: existing.periodYear, dueDate: existing.dueDate }
      : planned
        ? { id: null, periodYear: planned.periodYear, dueDate: planned.dueDate }
        : null;
    const notCoveredReportingYears = included ? overdueBeforeBundle(period, requirements).map((r) => r.periodYear) : [];
    const stateFeeCents = governmentFeeFor(rule, { isNonprofit: business.is_nonprofit });
    const bundlePrice = priceInput(resolveServicePrice(prices, { filingTypeCode: SERVICES.ra_annual_report_bundle.filingTypeCode, ...scope }), "the bundle");
    const quote = bundleQuote({
      stateName,
      situation,
      bundlePrice,
      changePrice,
      changeGovernmentFeeCents,
      includedReportingYear: included?.periodYear ?? null,
      annualReportStateFeeCents: stateFeeCents,
      notCoveredReportingYears,
    });
    return {
      ...base,
      quote,
      bundle: included
        ? { periodStart, periodEnd, reportingYear: included.periodYear, requirementId: included.id, ruleKey: rule.ruleKey, dueDate: included.dueDate, stateFeeCents }
        : null,
    };
  } catch (e) {
    if (e instanceof QuoteError) return { ...base, sale: { ok: false, reason: e.message } };
    throw e;
  }
}

export interface ServiceCheckoutInput {
  businessId: string;
  service: OrderableService;
  /** Optional: the state record shows the current agent, and an operator checks it before filing. */
  currentAgentName: string | null;
  contactName: string;
  contactPhone: string;
  contactAddress: string;
  /** Owners' names and home addresses, where the jurisdiction's provider needs them (Wyoming). */
  beneficialOwners: string | null;
  acceptedTerms: boolean;
}

/**
 * Checkout details. Only what the provider can ask for at short notice (a real contact person,
 * their phone and a physical address) is required before payment, plus consent to the
 * renewal terms. Whether this is a switch is derived from the business, never asked.
 */
export function validateServiceCheckoutInput(raw: Record<string, unknown>): { ok: true; value: ServiceCheckoutInput } | { ok: false; error: string } {
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const service = s("service");
  if (!isOrderableService(service)) return { ok: false, error: "Choose a service." };
  const contactName = s("contactName");
  const contactPhone = s("contactPhone");
  const contactAddress = s("contactAddress");
  if (contactName.length < 2 || contactName.length > 200) return { ok: false, error: "Enter the name of the person we should contact." };
  if (!/^[0-9+() .-]{7,30}$/.test(contactPhone) || (contactPhone.match(/\d/g) ?? []).length < 7) return { ok: false, error: "Enter a phone number we can reach that person on." };
  if (contactAddress.length < 5 || contactAddress.length > 500) return { ok: false, error: "Enter that person's street address (not a PO box)." };
  if (/\bP\.?\s*O\.?\s*Box\b/i.test(contactAddress)) return { ok: false, error: "Enter a street address, not a PO box." };
  const currentAgentName = s("currentAgentName");
  if (currentAgentName.length > 200) return { ok: false, error: "Shorten your current agent's name." };
  const beneficialOwners = s("beneficialOwners");
  if (beneficialOwners.length > 2000) return { ok: false, error: "Shorten the owners list." };
  if (raw.acceptedTerms !== "on" && raw.acceptedTerms !== true) return { ok: false, error: "Please agree to the terms to continue." };
  return {
    ok: true,
    value: {
      businessId: s("businessId"),
      service,
      currentAgentName: currentAgentName.length >= 2 ? currentAgentName : null,
      contactName,
      contactPhone,
      contactAddress,
      beneficialOwners: beneficialOwners.length >= 2 ? beneficialOwners : null,
      acceptedTerms: true,
    },
  };
}

/**
 * Settle an earlier unpaid order for the same business and state before a new one: a
 * session the provider says is paid is applied instead of replaced; open ones are expired
 * and the unpaid records are closed, so the customer can never pay twice.
 */
async function settleEarlierOrders(businessId: string, stateCode: string): Promise<{ paidSubscriptionId: string | null }> {
  const db = createAdminClient();
  const { data: subs } = await db
    .from("ra_subscriptions")
    .select("id, order_id, billing_status, service_status, user_id")
    .eq("business_id", businessId)
    .eq("state_code", stateCode)
    .neq("service_status", "ended")
    .neq("billing_status", "canceled");
  for (const sub of subs ?? []) {
    if (sub.billing_status !== "pending") {
      throw new ServiceOrderError("This business already has registered agent service with us in this state. Manage it from your dashboard.", "not_allowed");
    }
    const { data: pays } = await db
      .from("payments")
      .select("id, order_id, provider, provider_session_id, status")
      .eq("order_id", sub.order_id)
      .eq("status", "pending");
    const provider = getPaymentProvider();
    for (const p of pays ?? []) {
      if (!p.provider_session_id || p.provider !== provider.name) continue;
      const session = await provider.retrieveSession(p.provider_session_id);
      if (session?.paid && session.paymentId === p.id) {
        await applyVerified(p, session.amountCents, session.currency, session.providerPaymentId, session.subscriptionId ?? null, session.invoiceId ?? null);
        return { paidSubscriptionId: sub.id };
      }
      if (session?.status === "open") await provider.expireSession(p.provider_session_id);
      await db.from("payments").update({ status: "expired" }).eq("id", p.id).eq("status", "pending");
    }
    await db.from("orders").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", sub.order_id).in("status", ["pending_payment", "payment_failed", "expired"]);
    await db.from("ra_subscriptions").update({ billing_status: "canceled", service_status: "ended" }).eq("id", sub.id).eq("billing_status", "pending");
    const { data: pos } = await db.from("provider_orders").select("id").eq("order_id", sub.order_id).eq("status", "new_order");
    for (const po of pos ?? []) {
      await db.rpc("transition_provider_order", {
        p_id: po.id,
        p_to_status: "cancelled",
        p_actor_user_id: null,
        p_actor_type: "system",
        p_note: "Replaced by a newer checkout before payment",
        p_customer_visible: false,
        p_patch: {},
        p_expected_from: "new_order",
      });
    }
  }
  return { paidSubscriptionId: null };
}

export async function applyVerified(
  payment: { id: string; order_id: string },
  amountCents: number | null,
  currency: string | null,
  providerPaymentId: string | null,
  subscriptionId: string | null,
  invoiceId: string | null,
) {
  const db = createAdminClient();
  const { data, error } = await db.rpc("apply_payment_success", {
    p_payment_id: payment.id,
    p_provider_payment_id: providerPaymentId,
    p_receipt_url: null,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_event_at: new Date().toISOString(),
  });
  if (error) throw new Error(`apply_payment_success: ${error.message}`);
  const res = data as { applied?: boolean; user_id?: string } | null;
  if (res?.applied) {
    await afterServiceOrderPaid({ orderId: payment.order_id, subscriptionId, invoiceId, providerPaymentId });
  }
}

/**
 * Open the report the bundle includes when it has no row yet, the same row the reminder
 * engine opens once the current year is resolved. Idempotent on (business, rule, year).
 */
async function openPlannedRequirement(
  userId: string,
  businessId: string,
  bundle: { reportingYear: number; ruleKey: string; dueDate: string },
): Promise<string> {
  const current = await getCurrentRuleVersion(bundle.ruleKey);
  if (!current) throw new ServiceOrderError("Filing rules are not available right now.", "unavailable");
  const db = createAdminClient();
  const { error } = await db.from("filing_requirements").upsert(
    { business_id: businessId, owner_user_id: userId, rule_id: current.ruleId, period_year: bundle.reportingYear, due_date: bundle.dueDate, status: "open" },
    { onConflict: "business_id,rule_id,period_year", ignoreDuplicates: true },
  );
  if (error) throw new ServiceOrderError(`Could not save the order: ${error.message}`);
  const { data } = await db
    .from("filing_requirements")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("rule_id", current.ruleId)
    .eq("period_year", bundle.reportingYear)
    .single();
  if (!data || data.status !== "open") throw new ServiceOrderError("That annual report is no longer open, so the bundle can't include it.", "not_allowed");
  await ensureRemindersForRequirement(data.id as string);
  return data.id as string;
}

export async function startServiceCheckout(u: SessionUser, input: ServiceCheckoutInput): Promise<{ url: string }> {
  const preview = await previewServiceOrder(u, input);
  if (!preview.sale.ok || !preview.quote) throw new ServiceOrderError(preview.sale.reason ?? "This service isn't available yet.", "unavailable");
  const { business, quote } = preview;
  if (getRaJurisdiction(business.state_code)?.extraIntake.beneficialOwners && !input.beneficialOwners) {
    throw new ServiceOrderError("Enter the name and home address of each owner.", "invalid");
  }

  const provider = getPaymentProvider();
  if (requiresApprovedPrice(provider.mode) && !quote.pricesApproved) {
    throw new ServiceOrderError("Online payment isn't open yet for this service. Nothing has been charged.", "unavailable");
  }

  const settled = await settleEarlierOrders(business.id, business.state_code);
  if (settled.paidSubscriptionId) return { url: absoluteUrl(`/dashboard/services/${settled.paidSubscriptionId}`) };

  const db = createAdminClient();
  const economics = economicsFromLines(quote.lines);
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      user_id: u.id,
      business_id: business.id,
      status: "pending_payment",
      currency: "usd",
      order_type: "business_services",
      government_fee_cents: quote.governmentFeeCents,
      service_fee_cents: quote.serviceFeeCents,
      total_cents: quote.dueTodayCents,
      pricing_snapshot: {
        kind: "business_services",
        service: input.service,
        situation: preview.situation,
        state_code: business.state_code,
        state_name: preview.stateName,
        entity_type: business.entity_type,
        price_variant: STANDARD_PRICE_VARIANT,
        quote,
        economics,
        bundle: preview.bundle,
      },
      payment_mode: provider.mode,
    })
    .select("id")
    .single();
  if (orderError || !order) throw new ServiceOrderError(`Could not create the order: ${orderError?.message}`);
  const orderId = order.id as string;

  const { error: itemsError } = await db.from("order_items").insert(
    quote.lines.map((l) => ({ order_id: orderId, kind: l.kind, description: l.description, amount_cents: l.amountCents, service_code: l.serviceCode, billing: l.billing })),
  );
  if (itemsError) throw new ServiceOrderError(`Could not save the order: ${itemsError.message}`);

  const { data: sub, error: subError } = await db
    .from("ra_subscriptions")
    .insert({
      user_id: u.id,
      business_id: business.id,
      state_code: business.state_code,
      plan: input.service,
      origin: preview.situation,
      order_id: orderId,
      renewal_price_cents: quote.renewal?.amountCents ?? 0,
      contact_name: input.contactName,
      contact_phone: input.contactPhone,
      contact_address: input.contactAddress,
    })
    .select("id")
    .single();
  if (subError || !sub) throw new ServiceOrderError(`Could not save the order: ${subError?.message}`);

  const providerOrders: Record<string, unknown>[] = [
    {
      user_id: u.id,
      business_id: business.id,
      order_id: orderId,
      ra_subscription_id: sub.id,
      kind: "registered_agent",
      state_code: business.state_code,
      wholesale_cost_cents: WHOLESALE.registeredAgentPerYear,
      details: {
        situation: preview.situation,
        entity_type: business.entity_type,
        legal_name: business.legal_name,
        ...(input.beneficialOwners ? { beneficial_owners: input.beneficialOwners } : {}),
      },
    },
  ];
  if (preview.situation === "switching") {
    providerOrders.push({
      user_id: u.id,
      business_id: business.id,
      order_id: orderId,
      ra_subscription_id: sub.id,
      kind: "change_of_agent",
      state_code: business.state_code,
      government_fee_cents: quote.lines.filter((l) => l.serviceCode === "change_registered_agent" && l.kind === "government_fee").reduce((n, l) => n + l.amountCents, 0),
      wholesale_cost_cents: WHOLESALE.changeOfAgent,
      details: { current_agent_name: input.currentAgentName, entity_type: business.entity_type, legal_name: business.legal_name },
    });
  }
  const { error: poError } = await db.from("provider_orders").insert(providerOrders);
  if (poError) throw new ServiceOrderError(`Could not save the order: ${poError.message}`);

  if (preview.bundle) {
    const requirementId = preview.bundle.requirementId ?? (await openPlannedRequirement(u.id, business.id, preview.bundle));
    const { error: bError } = await db.from("bundle_filing_periods").insert({
      ra_subscription_id: sub.id,
      user_id: u.id,
      business_id: business.id,
      period_start: preview.bundle.periodStart,
      period_end: preview.bundle.periodEnd,
      reporting_year: preview.bundle.reportingYear,
      requirement_id: requirementId,
      state_fee_cents: preview.bundle.stateFeeCents,
    });
    if (bError) {
      throw new ServiceOrderError(
        bError.code === "23505" ? "That annual report is already covered by another plan." : `Could not save the order: ${bError.message}`,
        bError.code === "23505" ? "not_allowed" : "invalid",
      );
    }
  }

  const { data: payment, error: payError } = await db
    .from("payments")
    .insert({ order_id: orderId, user_id: u.id, provider: provider.name, mode: provider.mode, amount_cents: quote.dueTodayCents, currency: "usd", status: "pending" })
    .select("id")
    .single();
  if (payError || !payment) throw new ServiceOrderError(`Could not start payment: ${payError?.message}`);

  const session = await provider.createCheckoutSession({
    orderId,
    paymentId: payment.id,
    // Zero-amount lines (an included change filing) stay on the order but are not sent to
    // the processor, which refuses them in subscription mode.
    lineItems: quote.lines
      .filter((l) => l.amountCents > 0)
      .map((l) => ({
        kind: l.kind,
        name: l.description,
        amountCents: l.amountCents,
        ...(l.billing === "annual" ? { recurring: { interval: "year" as const } } : {}),
      })),
    totalCents: quote.dueTodayCents,
    currency: "usd",
    customerEmail: u.email,
    description: `${SERVICES[input.service].name} for ${business.legal_name} in ${preview.stateName}`,
    successUrl: absoluteUrl(`/dashboard/services/${sub.id}`),
    cancelUrl: absoluteUrl(`/dashboard/services/new?business=${business.id}&cancelled=1`),
    idempotencyKey: `service-checkout:${payment.id}`,
  });
  await db.from("payments").update({ provider_session_id: session.sessionId }).eq("id", payment.id);
  await rememberContact(u.id, input);

  await audit({
    actorUserId: u.id,
    actorType: "customer",
    action: "service_checkout.started",
    entityType: "order",
    entityId: orderId,
    after: { service: input.service, situation: preview.situation, total_cents: quote.dueTodayCents, mode: provider.mode, state_code: business.state_code },
  });
  await trackServer("checkout_started", {
    userId: u.id,
    stateCode: business.state_code,
    filingTypeCode: SERVICES[input.service].filingTypeCode,
    entityType: business.entity_type,
    properties: { order_id: orderId, service_code: input.service, situation: preview.situation, price_variant: STANDARD_PRICE_VARIANT },
  });
  return { url: session.url };
}

/** Fill the profile's empty name and phone from the contact given, so the next order is prefilled. Never overwrites. */
async function rememberContact(userId: string, input: Pick<ServiceCheckoutInput, "contactName" | "contactPhone">): Promise<void> {
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
  if (!profile) return;
  const patch: { full_name?: string; phone?: string } = {};
  if (!profile.full_name?.trim()) patch.full_name = input.contactName;
  if (!profile.phone?.trim()) patch.phone = input.contactPhone;
  if (Object.keys(patch).length) await db.from("profiles").update(patch).eq("id", userId);
}

export interface OrderPrefill {
  contactName: string;
  contactPhone: string;
  contactAddress: string;
  currentAgentName: string;
}

/** One line of a stored address ("1 Main St, Suite 2, Austin, TX 78701"). */
export function addressLine(a: { line1?: string | null; line2?: string | null; city?: string | null; region?: string | null; postal_code?: string | null } | null | undefined): string {
  if (!a?.line1) return "";
  const cityLine = [a.city, [a.region, a.postal_code].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ");
  return [a.line1, a.line2, cityLine].filter((x) => x && String(x).trim()).join(", ");
}

/**
 * What we already know, so the order form opens filled in: the customer's last contact on any
 * registered agent order, else their profile; the business's office address; the agent the
 * state record named, where we saved it. The customer can change any of it.
 */
export async function loadOrderPrefill(userId: string, businessId: string): Promise<OrderPrefill> {
  const db = createAdminClient();
  const [{ data: profile }, { data: lastSub }, { data: addresses }] = await Promise.all([
    db.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    db.from("ra_subscriptions").select("contact_name, contact_phone, contact_address").eq("user_id", userId).not("contact_name", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    businessId
      ? db.from("business_addresses").select("kind, line1, line2, city, region, postal_code, crop_name").eq("business_id", businessId)
      : Promise.resolve({ data: [] as { kind: string; line1: string | null; line2: string | null; city: string | null; region: string | null; postal_code: string | null; crop_name: string | null }[] }),
  ]);
  const byKind = (k: string) => (addresses ?? []).find((a) => a.kind === k);
  const office = byKind("principal_office") ?? byKind("mailing");
  const officeLine = addressLine(office);
  return {
    contactName: lastSub?.contact_name ?? profile?.full_name ?? "",
    contactPhone: lastSub?.contact_phone ?? profile?.phone ?? "",
    contactAddress: officeLine && !/\bP\.?\s*O\.?\s*Box\b/i.test(officeLine) ? officeLine : (lastSub?.contact_address ?? ""),
    currentAgentName: byKind("registered_office")?.crop_name ?? "",
  };
}

/**
 * On return from hosted checkout, ask the provider (never trust the redirect) and apply a
 * paid session through the same idempotent path the webhook uses.
 */
export async function reconcileServiceCheckoutReturn(u: SessionUser, subscriptionId: string, sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  const db = createAdminClient();
  const { data: sub } = await db.from("ra_subscriptions").select("id, user_id, order_id, billing_status").eq("id", subscriptionId).maybeSingle();
  if (!sub || sub.user_id !== u.id || sub.billing_status !== "pending") return;
  const { data: payment } = await db.from("payments").select("id, order_id, user_id, provider, status").eq("provider_session_id", sessionId).maybeSingle();
  if (!payment || payment.user_id !== u.id || payment.order_id !== sub.order_id) return;
  let provider;
  try {
    provider = getPaymentProvider();
  } catch {
    return;
  }
  if (provider.name !== payment.provider) return;
  const session = await provider.retrieveSession(sessionId);
  if (session?.paid && session.paymentId === payment.id) {
    await applyVerified(payment, session.amountCents, session.currency, session.providerPaymentId, session.subscriptionId ?? null, session.invoiceId ?? null);
  }
}

/**
 * Turn renewal off (or back on). Never ends the paid year early and never tells the
 * provider or the state anything: the appointment stays until the period ends and an
 * operator handles the hand-over.
 */
export async function setRenewal(u: SessionUser, subscriptionId: string, renew: boolean): Promise<void> {
  const db = createAdminClient();
  const { data: sub } = await db
    .from("ra_subscriptions")
    .select("id, user_id, business_id, state_code, plan, billing_status, provider_subscription_id, cancel_at_period_end, current_period_end, renewal_price_cents")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!sub || sub.user_id !== u.id) throw new ServiceOrderError("Service not found", "not_found");
  if (!["active", "past_due"].includes(sub.billing_status) || !sub.provider_subscription_id) {
    throw new ServiceOrderError("Renewal can't be changed for this service right now.", "not_allowed");
  }
  if (sub.cancel_at_period_end === !renew) return;
  await getPaymentProvider().setCancelAtPeriodEnd(sub.provider_subscription_id, !renew);
  const nowIso = new Date().toISOString();
  await db
    .from("ra_subscriptions")
    .update({ cancel_at_period_end: !renew, cancellation_requested_at: renew ? null : nowIso })
    .eq("id", sub.id);
  await audit({
    actorUserId: u.id,
    actorType: "customer",
    action: renew ? "ra_subscription.renewal_resumed" : "ra_subscription.renewal_cancelled",
    entityType: "ra_subscription",
    entityId: sub.id,
    before: { cancel_at_period_end: sub.cancel_at_period_end },
    after: { cancel_at_period_end: !renew },
  });
  if (!renew) {
    const { data: business } = await db.from("businesses").select("legal_name").eq("id", sub.business_id).maybeSingle();
    await sendNotification({
      userId: u.id,
      templateKey: "ra_renewal_cancelled",
      dedupeKey: `ra_renewal_cancelled:${sub.id}:${nowIso.slice(0, 10)}`,
      vars: {
        company_name: business?.legal_name ?? "your business",
        state_name: getRaJurisdiction(sub.state_code)?.name ?? sub.state_code,
        service_name: SERVICES[sub.plan as OrderableService].name.toLowerCase(),
        renewal_date: sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" }) : "the end of your current year",
        renewal_amount: formatCents(sub.renewal_price_cents),
      },
      ctaPath: `/dashboard/services/${sub.id}`,
      businessId: sub.business_id,
    });
    await trackServer("subscription_cancelled", {
      userId: u.id,
      stateCode: sub.state_code,
      filingTypeCode: SERVICES[sub.plan as OrderableService].filingTypeCode,
      properties: { ra_subscription_id: sub.id, service_code: sub.plan, kind: "renewal_turned_off" },
      dedupeKey: `subscription_cancelled:${sub.id}:${nowIso.slice(0, 10)}`,
    });
  }
}
