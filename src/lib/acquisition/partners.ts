import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Referral partners (accountants, bookkeepers, tax preparers, consultants, formation
 * services): CRM-style tracking only. No commissions, payouts or partner logins. A partner
 * can be given a link like getfilewell.com/?ref=<code>; visits through it are attributed
 * as source "accountant_referral" with the code as the campaign.
 */

const db = () => createAdminClient();

export const PARTNER_KINDS = ["accountant", "bookkeeper", "tax_preparer", "consultant", "formation_service", "other"] as const;
export const PARTNER_STATUSES = ["to_contact", "contacted", "responded", "interested", "not_interested", "active"] as const;

export interface PartnerInput {
  firmName: string;
  kind: (typeof PARTNER_KINDS)[number];
  websiteUrl: string | null;
  publicContact: string | null;
  status: (typeof PARTNER_STATUSES)[number];
  contactedOn: string | null;
  response: string | null;
  refCode: string | null;
  notes: string | null;
}

export interface PartnerView extends PartnerInput {
  id: string;
  referredCustomers: number;
  serviceRevenueCents: number;
}

const toRow = (p: PartnerInput, staffId: string) => ({
  firm_name: p.firmName,
  kind: p.kind,
  website_url: p.websiteUrl,
  public_contact: p.publicContact,
  status: p.status,
  contacted_on: p.contactedOn,
  response: p.response,
  ref_code: p.refCode,
  notes: p.notes,
  updated_by: staffId,
});

export async function savePartner(id: string | null, p: PartnerInput, staffId: string): Promise<void> {
  const res = id
    ? await db().from("referral_partners").update(toRow(p, staffId)).eq("id", id)
    : await db().from("referral_partners").insert(toRow(p, staffId));
  if (res.error) throw new Error(res.error.code === "23505" ? "That referral code is already used by another partner." : res.error.message);
}

/** Paid live orders (service fee) for businesses whose attribution carries a partner code. */
export async function referralTotals(): Promise<Map<string, { customers: Set<string>; revenue: number }>> {
  const out = new Map<string, { customers: Set<string>; revenue: number }>();
  const { data: attrs } = await db().from("business_attribution").select("business_id, user_id, attribution").limit(20000);
  const codeByBusiness = new Map<string, string>();
  for (const a of attrs ?? []) {
    const at = a.attribution as { ft?: { s?: string; c?: string }; lt?: { s?: string; c?: string } };
    const touch = at.lt?.s === "accountant_referral" ? at.lt : at.ft?.s === "accountant_referral" ? at.ft : null;
    if (touch?.c) codeByBusiness.set(a.business_id as string, touch.c);
  }
  if (!codeByBusiness.size) return out;
  const { data: orders } = await db()
    .from("orders")
    .select("business_id, user_id, service_fee_cents")
    .in("business_id", [...codeByBusiness.keys()])
    .in("status", ["paid", "partially_refunded"])
    .eq("payment_mode", "live");
  for (const o of orders ?? []) {
    const code = codeByBusiness.get(o.business_id as string)!;
    const t = out.get(code) ?? { customers: new Set<string>(), revenue: 0 };
    t.customers.add(o.user_id as string);
    t.revenue += Number(o.service_fee_cents);
    out.set(code, t);
  }
  return out;
}

export async function listPartners(): Promise<PartnerView[]> {
  const [{ data }, totals] = await Promise.all([
    db().from("referral_partners").select("*").order("updated_at", { ascending: false }).limit(500),
    referralTotals(),
  ]);
  return (data ?? []).map((r) => {
    const t = r.ref_code ? totals.get(r.ref_code as string) : undefined;
    return {
      id: r.id as string,
      firmName: r.firm_name as string,
      kind: r.kind,
      websiteUrl: r.website_url,
      publicContact: r.public_contact,
      status: r.status,
      contactedOn: r.contacted_on,
      response: r.response,
      refCode: r.ref_code,
      notes: r.notes,
      referredCustomers: t?.customers.size ?? 0,
      serviceRevenueCents: t?.revenue ?? 0,
    } as PartnerView;
  });
}
