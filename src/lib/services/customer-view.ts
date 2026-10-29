import "server-only";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import type { ServiceDocumentKind } from "@/lib/registered-agent/documents";
import type { BillingStatus, ProviderOrderKind, ProviderOrderStatus, ServiceStatus } from "@/lib/registered-agent/status";
import { createClient } from "@/lib/supabase/server";

/**
 * Customer views of registered agent service. Read with the customer's own client, so
 * row-level security decides what they can see (their own rows, customer-visible history
 * and documents only).
 */

export interface ServiceSummaryView {
  id: string;
  businessId: string;
  businessName: string;
  stateCode: string;
  stateName: string;
  plan: "registered_agent" | "ra_annual_report_bundle";
  billingStatus: BillingStatus;
  serviceStatus: ServiceStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  renewalPriceCents: number;
}

export interface ServiceDetailView extends ServiceSummaryView {
  origin: "switching" | "new_entity" | "formation_add_on";
  appointmentConfirmedAt: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  providerName: string;
  orders: { id: string; kind: ProviderOrderKind; status: ProviderOrderStatus; confirmedOn: string | null }[];
  history: { id: number; toStatus: ProviderOrderStatus; note: string | null; createdAt: string; kind: ProviderOrderKind }[];
  documents: { id: string; kind: ServiceDocumentKind; summary: string | null; fileName: string; createdAt: string; urgency: "urgent" | "high" | "normal" }[];
  bundleYears: { periodStart: string; periodEnd: string; reportingYear: number | null; status: string }[];
}

type SubRow = {
  id: string;
  business_id: string;
  state_code: string;
  plan: ServiceSummaryView["plan"];
  billing_status: BillingStatus;
  service_status: ServiceStatus;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  renewal_price_cents: number;
  businesses: { legal_name: string } | { legal_name: string }[] | null;
};

function summary(r: SubRow): ServiceSummaryView {
  const b = Array.isArray(r.businesses) ? r.businesses[0] : r.businesses;
  return {
    id: r.id,
    businessId: r.business_id,
    businessName: b?.legal_name ?? "Your business",
    stateCode: r.state_code,
    stateName: getRaJurisdiction(r.state_code)?.name ?? r.state_code,
    plan: r.plan,
    billingStatus: r.billing_status,
    serviceStatus: r.service_status,
    cancelAtPeriodEnd: r.cancel_at_period_end,
    currentPeriodEnd: r.current_period_end,
    renewalPriceCents: r.renewal_price_cents,
  };
}

const SUMMARY_COLUMNS =
  "id, business_id, state_code, plan, billing_status, service_status, cancel_at_period_end, current_period_end, renewal_price_cents, businesses(legal_name)";

/** Services for one business (or all of the user's), excluding never-paid checkouts. */
export async function listServices(userId: string, businessId?: string): Promise<ServiceSummaryView[]> {
  const db = await createClient();
  let q = db.from("ra_subscriptions").select(SUMMARY_COLUMNS).eq("user_id", userId).neq("billing_status", "pending").order("created_at", { ascending: false });
  if (businessId) q = q.eq("business_id", businessId);
  const { data } = await q;
  return ((data ?? []) as unknown as SubRow[]).map(summary);
}

export async function loadServiceDetail(userId: string, id: string): Promise<ServiceDetailView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await createClient();
  const { data } = await db
    .from("ra_subscriptions")
    .select(`${SUMMARY_COLUMNS}, origin, appointment_confirmed_at, contact_name, contact_phone, contact_address, user_id`)
    .eq("id", id)
    .maybeSingle();
  if (!data || data.user_id !== userId) return null;
  const row = data as unknown as SubRow & {
    origin: ServiceDetailView["origin"];
    appointment_confirmed_at: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_address: string | null;
  };
  const [{ data: orders }, { data: docs }, { data: years }] = await Promise.all([
    db.from("provider_orders").select("id, kind, status, confirmed_on").eq("ra_subscription_id", id).order("created_at"),
    db.from("service_documents").select("id, kind, summary, file_name, created_at, urgency").eq("ra_subscription_id", id).order("created_at", { ascending: false }),
    db.from("bundle_filing_periods").select("period_start, period_end, reporting_year, status").eq("ra_subscription_id", id).order("period_start"),
  ]);
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: events } = orderIds.length
    ? await db.from("provider_order_events").select("id, provider_order_id, to_status, note, created_at").in("provider_order_id", orderIds).order("created_at", { ascending: false })
    : { data: [] as { id: number; provider_order_id: string; to_status: string; note: string | null; created_at: string }[] };
  const kindOf = new Map((orders ?? []).map((o) => [o.id, o.kind as ProviderOrderKind]));
  return {
    ...summary(row),
    origin: row.origin,
    appointmentConfirmedAt: row.appointment_confirmed_at,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactAddress: row.contact_address,
    providerName: PROVIDER_LEGAL_NAME,
    orders: (orders ?? []).map((o) => ({ id: o.id, kind: o.kind as ProviderOrderKind, status: o.status as ProviderOrderStatus, confirmedOn: o.confirmed_on })),
    history: (events ?? []).map((e) => ({
      id: e.id,
      toStatus: e.to_status as ProviderOrderStatus,
      note: e.note,
      createdAt: e.created_at,
      kind: kindOf.get(e.provider_order_id) ?? "registered_agent",
    })),
    documents: (docs ?? []).map((d) => ({
      id: d.id,
      kind: d.kind as ServiceDocumentKind,
      summary: d.summary,
      fileName: d.file_name,
      createdAt: d.created_at,
      urgency: d.urgency as "urgent" | "high" | "normal",
    })),
    bundleYears: (years ?? []).map((y) => ({ periodStart: y.period_start, periodEnd: y.period_end, reportingYear: y.reporting_year, status: y.status })),
  };
}
