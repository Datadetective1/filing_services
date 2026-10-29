import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { STANDARD_PRICE_VARIANT } from "./catalog";

/**
 * Which annual report price variant new checkouts use. "standard" (the live $49 price)
 * unless ANNUAL_REPORT_PRICE_VARIANT names another variant, such as "proposed_79". A
 * variant row still needs admin approval before live checkout accepts it, and orders
 * already created keep the price they were created with.
 */
export function annualReportPriceVariant(): string {
  const v = process.env.ANNUAL_REPORT_PRICE_VARIANT?.trim();
  return v && /^[a-z0-9_]{1,40}$/.test(v) ? v : STANDARD_PRICE_VARIANT;
}

export interface BundleCoverage {
  periodId: string;
  subscriptionId: string;
  reportingYear: number;
}

/**
 * The bundle year that already paid Filewell's service for this annual report, if any:
 * a live bundle period for the same business and requirement, on a subscription whose
 * billing is active. Its filing is then quoted with a $0 Filewell service fee; the state
 * fee is still charged, at this checkout, once the customer has authorized the filing.
 */
export async function bundleCoverageFor(filing: { id?: string; business_id: string; requirement_id?: string | null }): Promise<BundleCoverage | null> {
  if (!filing.requirement_id) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("bundle_filing_periods")
    .select("id, ra_subscription_id, reporting_year, filing_id, status, ra_subscriptions!inner(billing_status, business_id)")
    .eq("requirement_id", filing.requirement_id)
    .eq("business_id", filing.business_id)
    .in("status", ["scheduled", "awaiting_authorization", "authorized", "filing_in_progress"])
    .maybeSingle();
  if (!data) return null;
  const sub = (Array.isArray(data.ra_subscriptions) ? data.ra_subscriptions[0] : data.ra_subscriptions) as { billing_status: string; business_id: string } | null;
  if (!sub || sub.billing_status !== "active" || sub.business_id !== filing.business_id) return null;
  if (data.filing_id && filing.id && data.filing_id !== filing.id) return null;
  return { periodId: String(data.id), subscriptionId: String(data.ra_subscription_id), reportingYear: Number(data.reporting_year) };
}
