import "server-only";
import { absoluteUrl, site } from "@/config/site";
import { audit } from "@/lib/audit";
import { trackServer } from "@/lib/analytics/server";
import type { SessionUser } from "@/lib/auth/session";
import { resolveServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { listActivePricesAdmin } from "@/lib/filings/rules-db";
import { getPaymentProvider, requiresApprovedPrice } from "@/lib/payments";
import { getRaJurisdiction, type RaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import {
  providerReportFacts,
  providerReportFeeCents,
  providerReportSaleCheck,
} from "@/lib/registered-agent/provider-report";
import { RA_ENTITY_TYPES, type SaleCheck } from "@/lib/registered-agent/sales";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SERVICES, STANDARD_PRICE_VARIANT, WHOLESALE } from "./catalog";
import { economicsFromLines } from "./economics";
import { applyVerified, loadOwnedBusiness, ServiceOrderError } from "./orders";
import { providerAnnualReportQuote, QuoteError, type ServiceQuote } from "./quote";

/**
 * Annual reports in the states Filewell doesn't file itself. The customer pays Filewell's
 * service fee plus the state's verified report fee; Registered Agents Inc. files the report,
 * ordered by an operator in the partner dashboard (the provider order is flagged "Send to
 * RAI" in /admin/registered-agent). Like formation, one checkout, nothing recurs.
 */

export interface ProviderReportPreview {
  jurisdiction: RaJurisdiction;
  entityType: EntityType;
  reportName: string;
  sale: SaleCheck;
  quote: ServiceQuote | null;
}

/** The quote for this state and entity type, without creating anything. */
export async function previewProviderReport(input: { stateCode: string; entityType: EntityType }): Promise<ProviderReportPreview | null> {
  const j = getRaJurisdiction(input.stateCode);
  const facts = j ? providerReportFacts(j.code) : null;
  if (!j || !facts || !RA_ENTITY_TYPES.includes(input.entityType)) return null;
  const sale = providerReportSaleCheck(j.code, input.entityType);
  const base: ProviderReportPreview = { jurisdiction: j, entityType: input.entityType, reportName: facts.reportName, sale, quote: null };
  if (!sale.ok) return base;
  const prices = await listActivePricesAdmin();
  const price = resolveServicePrice(prices, {
    filingTypeCode: SERVICES.provider_annual_report.filingTypeCode,
    stateCode: j.code,
    entityType: input.entityType,
    variant: STANDARD_PRICE_VARIANT,
  });
  if (!price) return { ...base, sale: { ok: false, reason: "Pricing isn't set up for annual reports here yet." } };
  try {
    const quote = providerAnnualReportQuote({
      stateName: j.name,
      reportName: facts.reportName,
      reportPrice: { id: price.id, serviceFeeCents: price.serviceFeeCents, approved: price.approved },
      reportGovernmentFeeCents: providerReportFeeCents(j.code, input.entityType),
    });
    return { ...base, quote };
  } catch (e) {
    if (e instanceof QuoteError) return { ...base, sale: { ok: false, reason: e.message } };
    throw e;
  }
}

export interface ProviderReportInput {
  stateCode: string;
  entityType: EntityType;
  /** A business already on the customer's dashboard, when they started from it. */
  businessId: string | null;
  businessName: string;
  /** The state's file number, when the customer knows it. */
  entityNumber: string | null;
  principalAddress: string;
  /** Managers, members, officers or directors as the report must list them. */
  people: string;
  /** Anything that changed since the last report (optional). */
  changes: string | null;
  contactName: string;
  contactPhone: string;
}

const PO_BOX = /\bP\.?\s*O\.?\s*Box\b/i;

/** Only what the provider needs to file the report, plus one contact. */
export function validateProviderReportInput(raw: Record<string, unknown>): { ok: true; value: ProviderReportInput } | { ok: false; error: string } {
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const stateCode = s("stateCode").toUpperCase();
  const j = getRaJurisdiction(stateCode);
  if (!j) return { ok: false, error: "Choose a state." };
  const entityType = s("entityType");
  if (entityType !== "llc" && entityType !== "corporation") return { ok: false, error: "Choose LLC or corporation." };
  if (s("formedHere") !== "yes") return { ok: false, error: `For now we only file for businesses formed in ${j.name}.` };
  if (s("pastDue") !== "no") {
    return {
      ok: false,
      error: `A late report can carry a state penalty we can't price online. Email ${site.supportEmail} and we'll quote it before you pay anything.`,
    };
  }
  const businessIdRaw = s("businessId");
  const businessId = /^[0-9a-f-]{36}$/i.test(businessIdRaw) ? businessIdRaw : null;
  const businessName = s("businessName").replace(/\s+/g, " ");
  if (businessName.length < 2 || businessName.length > 200) return { ok: false, error: "Enter the business's legal name as the state lists it." };
  const entityNumberRaw = s("entityNumber").replace(/\s+/g, "");
  if (entityNumberRaw && !/^[A-Za-z0-9-]{1,30}$/.test(entityNumberRaw)) return { ok: false, error: "Enter the state file number with letters, numbers and dashes only, or leave it blank." };
  const principalAddress = s("principalAddress");
  if (principalAddress.length < 5 || principalAddress.length > 500) return { ok: false, error: "Enter the business's street address." };
  if (PO_BOX.test(principalAddress)) return { ok: false, error: "Enter a street address, not a PO box." };
  const people = s("people");
  if (people.length < 2 || people.length > 2000) {
    return { ok: false, error: entityType === "llc" ? "Enter each member or manager's name and address." : "Enter each officer and director's name, title and address." };
  }
  const changes = s("changes").slice(0, 2000) || null;
  const contactName = s("contactName");
  const contactPhone = s("contactPhone");
  if (contactName.length < 2 || contactName.length > 200) return { ok: false, error: "Enter the name of the person we should contact." };
  if (!/^[0-9+() .-]{7,30}$/.test(contactPhone) || (contactPhone.match(/\d/g) ?? []).length < 7) {
    return { ok: false, error: "Enter a phone number we can reach that person on." };
  }
  if (raw.acceptedTerms !== "on" && raw.acceptedTerms !== true) return { ok: false, error: "Please agree to the terms to continue." };
  return {
    ok: true,
    value: {
      stateCode,
      entityType,
      businessId,
      businessName,
      entityNumber: entityNumberRaw || null,
      principalAddress,
      people,
      changes,
      contactName,
      contactPhone,
    },
  };
}

/** The customer's business for this order: the one they started from, or a new row for it. */
async function businessFor(u: SessionUser, input: ProviderReportInput, j: RaJurisdiction): Promise<string> {
  if (input.businessId) {
    const owned = await loadOwnedBusiness(u.id, input.businessId);
    if (!owned) throw new ServiceOrderError("Business not found.", "not_found");
    if (owned.state_code !== j.code || owned.entity_type !== input.entityType) {
      throw new ServiceOrderError(`That business isn't a ${j.name} ${input.entityType === "llc" ? "LLC" : "corporation"}.`);
    }
    if (owned.lifecycle === "forming") throw new ServiceOrderError("This business is still being formed, so it has no annual report yet.");
    if (owned.is_nonprofit || owned.is_foreign) throw new ServiceOrderError(`For now we only file for for-profit businesses formed in ${j.name}.`);
    return owned.id;
  }
  const db = await createClient();
  const { data, error } = await db
    .from("businesses")
    .insert({
      owner_user_id: u.id,
      legal_name: input.businessName,
      state_code: j.code,
      entity_type: input.entityType,
      state_entity_number: input.entityNumber,
      standing: "unknown",
      standing_source: "none",
    })
    .select("id")
    .single();
  if (error || !data) throw new ServiceOrderError(`Could not save the business: ${error?.message ?? "unknown"}`);
  await audit({
    actorUserId: u.id,
    actorType: "customer",
    action: "business.created",
    entityType: "business",
    entityId: String(data.id),
    after: { state_code: j.code, entity_type: input.entityType, source: "provider_annual_report_order" },
  });
  return String(data.id);
}

export async function startProviderReportCheckout(u: SessionUser, input: ProviderReportInput): Promise<{ url: string }> {
  const preview = await previewProviderReport({ stateCode: input.stateCode, entityType: input.entityType });
  if (!preview || !preview.sale.ok || !preview.quote) {
    throw new ServiceOrderError(preview?.sale.reason ?? "Annual report filing isn't open here yet.", "unavailable");
  }
  const j = preview.jurisdiction;
  const quote = preview.quote;
  const provider = getPaymentProvider();
  if (requiresApprovedPrice(provider.mode) && !quote.pricesApproved) {
    throw new ServiceOrderError("Online payment isn't open yet for this filing. Nothing has been charged.", "unavailable");
  }

  const businessId = await businessFor(u, input, j);
  const db = createAdminClient();
  const economics = economicsFromLines(quote.lines);
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      user_id: u.id,
      business_id: businessId,
      status: "pending_payment",
      currency: "usd",
      order_type: "business_services",
      government_fee_cents: quote.governmentFeeCents,
      service_fee_cents: quote.serviceFeeCents,
      total_cents: quote.dueTodayCents,
      pricing_snapshot: {
        kind: "business_services",
        service: "provider_annual_report",
        state_code: j.code,
        state_name: j.name,
        entity_type: input.entityType,
        report_name: preview.reportName,
        price_variant: STANDARD_PRICE_VARIANT,
        quote,
        economics,
      },
      payment_mode: provider.mode,
    })
    .select("id")
    .single();
  if (orderError || !order) throw new ServiceOrderError(`Could not create the order: ${orderError?.message}`);
  const orderId = order.id as string;

  const { error: itemsError } = await db.from("order_items").insert(
    quote.lines.map((l) => ({
      order_id: orderId,
      kind: l.kind,
      description: l.description,
      amount_cents: l.amountCents,
      service_code: l.serviceCode,
      billing: l.billing,
    })),
  );
  if (itemsError) throw new ServiceOrderError(`Could not save the order: ${itemsError.message}`);

  const { error: poError } = await db.from("provider_orders").insert({
    user_id: u.id,
    business_id: businessId,
    order_id: orderId,
    ra_subscription_id: null,
    kind: "annual_report",
    state_code: j.code,
    government_fee_cents: quote.governmentFeeCents,
    wholesale_cost_cents: WHOLESALE.annualReport,
    details: {
      report_name: preview.reportName,
      entity_type: input.entityType,
      legal_name: input.businessName,
      ...(input.entityNumber ? { entity_number: input.entityNumber } : {}),
      principal_address: input.principalAddress,
      people: input.people,
      ...(input.changes ? { changes: input.changes } : {}),
      contact_name: input.contactName,
      contact_phone: input.contactPhone,
      formed_here: true,
      past_due: false,
    },
  });
  if (poError) throw new ServiceOrderError(`Could not save the order: ${poError.message}`);

  const { data: payment, error: payError } = await db
    .from("payments")
    .insert({
      order_id: orderId,
      user_id: u.id,
      provider: provider.name,
      mode: provider.mode,
      amount_cents: quote.dueTodayCents,
      currency: "usd",
      status: "pending",
    })
    .select("id")
    .single();
  if (payError || !payment) throw new ServiceOrderError(`Could not start payment: ${payError?.message}`);

  const session = await provider.createCheckoutSession({
    orderId,
    paymentId: payment.id,
    lineItems: quote.lines.filter((l) => l.amountCents > 0).map((l) => ({ kind: l.kind, name: l.description, amountCents: l.amountCents })),
    totalCents: quote.dueTodayCents,
    currency: "usd",
    customerEmail: u.email,
    description: `${j.name} ${preview.reportName.toLowerCase()} for ${input.businessName}`,
    successUrl: absoluteUrl(`/dashboard/services/annual-report/${orderId}`),
    cancelUrl: absoluteUrl(`/dashboard/services/annual-report?state=${j.code}&type=${input.entityType}&cancelled=1`),
    idempotencyKey: `provider-report-checkout:${payment.id}`,
  });
  await db.from("payments").update({ provider_session_id: session.sessionId }).eq("id", payment.id);

  await audit({
    actorUserId: u.id,
    actorType: "customer",
    action: "service_checkout.started",
    entityType: "order",
    entityId: orderId,
    after: { service: "provider_annual_report", total_cents: quote.dueTodayCents, mode: provider.mode, state_code: j.code },
  });
  await trackServer("checkout_started", {
    userId: u.id,
    stateCode: j.code,
    filingTypeCode: SERVICES.provider_annual_report.filingTypeCode,
    entityType: input.entityType,
    properties: { order_id: orderId, service_code: "provider_annual_report", price_variant: STANDARD_PRICE_VARIANT },
  });
  return { url: session.url };
}

export interface ProviderReportStatus {
  orderId: string;
  businessId: string;
  businessName: string;
  stateName: string;
  reportName: string;
  paid: boolean;
  filingStatus: string;
}

/** The customer's own provider annual report order, reconciling a paid return from hosted checkout first. */
export async function loadProviderReportStatus(u: SessionUser, orderId: string, sessionId: string | null): Promise<ProviderReportStatus | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id, user_id, business_id, status, order_type, pricing_snapshot").eq("id", orderId).maybeSingle();
  const snapshot = (order?.pricing_snapshot ?? null) as { service?: string; report_name?: string } | null;
  if (!order || order.user_id !== u.id || order.order_type !== "business_services" || snapshot?.service !== "provider_annual_report") return null;
  if (sessionId && order.status === "pending_payment") {
    const { data: payment } = await db.from("payments").select("id, order_id, user_id, provider").eq("provider_session_id", sessionId).maybeSingle();
    if (payment && payment.user_id === u.id && payment.order_id === order.id) {
      try {
        const provider = getPaymentProvider();
        const session = provider.name === payment.provider ? await provider.retrieveSession(sessionId) : null;
        if (session?.paid && session.paymentId === payment.id) {
          await applyVerified(payment, session.amountCents, session.currency, session.providerPaymentId, session.subscriptionId ?? null, session.invoiceId ?? null);
        }
      } catch (e) {
        console.error("[provider-report] reconcile failed", e);
      }
    }
  }
  const [{ data: fresh }, { data: biz }, { data: po }] = await Promise.all([
    db.from("orders").select("status").eq("id", order.id).maybeSingle(),
    db.from("businesses").select("legal_name, state_code").eq("id", order.business_id).maybeSingle(),
    db.from("provider_orders").select("status").eq("order_id", order.id).eq("kind", "annual_report").maybeSingle(),
  ]);
  return {
    orderId: order.id,
    businessId: order.business_id,
    businessName: biz?.legal_name ?? "",
    stateName: getRaJurisdiction(biz?.state_code ?? "")?.name ?? biz?.state_code ?? "",
    reportName: snapshot?.report_name ?? "Annual report",
    paid: fresh?.status === "paid" || fresh?.status === "fulfilled",
    filingStatus: po?.status ?? "new_order",
  };
}
