import "server-only";
import { todayInTimeZone } from "@/lib/domain/dates";
import type { EntityType } from "@/lib/domain/types";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { PA_OPEN_DATA } from "@/lib/registry/pa-open-data-map";
import { createAdminClient } from "@/lib/supabase/admin";
import { cohortExclusions, formatMailAddress, selectCohort, type RecordAddress } from "./mail";
import { landingCode, landingUrl } from "./mail-codes";
import { buildMailPilot } from "./mail-service";
import { assessSituation } from "./segment";

/**
 * The frozen pilot cohort (marketing_sends.selected) and its funnel:
 * mailed -> visit -> record viewed -> filing started -> checkout started -> paid.
 */

export interface CohortRow {
  sendId: string;
  prospectId: string;
  selected: boolean;
  reasons: string[];
  businessName: string;
  entityNumber: string;
  entityType: EntityType | null;
  entityTypeLabel: string;
  address: RecordAddress | null;
  mailingAddress: string;
  deadline: string;
  periodYear: number | null;
  source: string;
  sourceUrl: string | null;
  retrievedAt: string;
  landingCode: string | null;
  landingUrl: string | null;
  clickedAt: string | null;
  recordViewedAt: string | null;
  businessId: string | null;
  vendorStatus: string | null;
  vendorTest: boolean | null;
  vendorId: string | null;
}

/**
 * Freeze a cohort from imported prospects with the strict pilot rules (duplicate-address
 * checks over the imported records). The production cohort was built with register-wide
 * checks by scripts/build-pa-mail-cohort.mts. Replaces any earlier cohort for the campaign.
 */
export async function freezeCohort(campaignId: string, size: number): Promise<{ selected: number; excluded: number }> {
  const rows = await buildMailPilot(campaignId, { persist: false });
  const evaluated = rows.map((r) => ({
    ...r,
    exclusions: cohortExclusions({
      entityType: r.entityType,
      isForeign: r.isForeign,
      address: r.address,
      situation: r.situation,
      isCustomer: r.exclusions.includes("existing_customer"),
      sharedCount: r.addressCount,
      registerAddressCount: r.addressCount,
      legalName: r.businessName,
    }),
  }));
  const { selected, excluded } = selectCohort(evaluated, size);
  const db = createAdminClient();
  await db.from("marketing_sends").delete().eq("campaign_id", campaignId);
  const all = [
    ...selected.map((r) => ({
      campaign_id: campaignId,
      prospect_id: r.prospectId,
      status: "dry_run",
      selected: true,
      reasons: [] as string[],
      landing_code: landingCode(campaignId, r.entityNumber),
    })),
    ...excluded.map((r) => ({
      campaign_id: campaignId,
      prospect_id: r.prospectId,
      status: "skipped",
      selected: false,
      reasons: r.exclusions.length ? (r.exclusions as string[]) : ["eligible_reserve"],
      landing_code: null,
    })),
  ];
  for (let i = 0; i < all.length; i += 500) {
    const { error } = await db.from("marketing_sends").insert(all.slice(i, i + 500));
    if (error) throw new Error(`cohort save failed: ${error.message}`);
  }
  return { selected: selected.length, excluded: excluded.length };
}

interface Rec {
  legal_name: string;
  entity_number: string;
  entity_type: string | null;
  entity_type_raw: string | null;
  is_foreign: boolean | null;
  formation_date: string | null;
  registered_office: RecordAddress | null;
  source: string;
  source_url: string | null;
  retrieved_at: string;
}

interface Joined {
  id: string;
  prospect_id: string;
  selected: boolean;
  reasons: string[];
  clicked_at: string | null;
  record_viewed_at: string | null;
  converted_business_id: string | null;
  vendor_status: string | null;
  vendor_test: boolean | null;
  provider_message_id: string | null;
  prospects: { state_entity_records: Rec };
}

export async function loadCohort(campaignId: string): Promise<CohortRow[]> {
  const db = createAdminClient();
  const today = todayInTimeZone("America/New_York");
  const out: CohortRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("marketing_sends")
      .select(
        "id, prospect_id, selected, reasons, clicked_at, record_viewed_at, converted_business_id, vendor_status, vendor_test, provider_message_id, prospects!inner(state_entity_records!inner(legal_name, entity_number, entity_type, entity_type_raw, is_foreign, formation_date, registered_office, source, source_url, retrieved_at))",
      )
      .eq("campaign_id", campaignId)
      .order("selected", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + 999);
    const rows = (data ?? []) as unknown as Joined[];
    for (const s of rows) {
      const r = s.prospects.state_entity_records;
      const entityType = (r.entity_type as EntityType | null) ?? null;
      const situation = assessSituation({ stateCode: "PA", entityType, isForeign: r.is_foreign, formationDate: r.formation_date, filedYears: null, today });
      const code = s.selected ? landingCode(campaignId, r.entity_number) : null;
      out.push({
        sendId: s.id,
        prospectId: s.prospect_id,
        selected: s.selected,
        reasons: s.reasons ?? [],
        businessName: r.legal_name,
        entityNumber: r.entity_number,
        entityType,
        entityTypeLabel: entityType ? `${r.is_foreign ? "Foreign " : ""}${ENTITY_TYPE_LABELS[entityType]}` : (r.entity_type_raw ?? "Unknown"),
        address: r.registered_office,
        mailingAddress: r.registered_office?.line1 ? formatMailAddress(r.registered_office) : "",
        deadline: situation.kind === "assessed" ? situation.dueDate : "",
        periodYear: situation.kind === "assessed" ? situation.periodYear : null,
        source: r.source === PA_OPEN_DATA.sourceName ? PA_OPEN_DATA.sourceLabel : r.source,
        sourceUrl: r.source_url,
        retrievedAt: r.retrieved_at,
        landingCode: code,
        landingUrl: code ? landingUrl(code) : null,
        clickedAt: s.clicked_at,
        recordViewedAt: s.record_viewed_at,
        businessId: s.converted_business_id,
        vendorStatus: s.vendor_status,
        vendorTest: s.vendor_test,
        vendorId: s.provider_message_id,
      });
    }
    if (rows.length < 1000) break;
  }
  return out;
}

export interface PilotFunnel {
  selected: number;
  mailed: number;
  visits: number;
  recordViews: number;
  filingStarts: number;
  checkouts: number;
  paid: number;
  serviceRevenueCents: number;
  stripeFeesCents: number;
}

/**
 * Funnel for the selected pieces. Visits and record views come from the landing code;
 * filing starts, checkouts and paid orders from the business the visitor created (linked at
 * start, or matched by entity number for businesses added after the campaign was created).
 * Revenue is Filewell's service fee on live paid orders, net of service-fee refunds.
 */
export async function pilotFunnel(campaignCreatedAt: string, cohort: CohortRow[]): Promise<PilotFunnel> {
  const db = createAdminClient();
  const selected = cohort.filter((r) => r.selected);
  const linked = new Set(selected.map((r) => r.businessId).filter((x): x is string => Boolean(x)));
  const numbers = selected.map((r) => r.entityNumber);
  if (numbers.length) {
    const { data: biz } = await db.from("businesses").select("id").eq("state_code", "PA").in("state_entity_number", numbers).gte("created_at", campaignCreatedAt);
    for (const b of biz ?? []) linked.add(b.id as string);
  }
  const ids = [...linked];
  const funnel: PilotFunnel = {
    selected: selected.length,
    mailed: selected.filter((r) => r.vendorStatus && r.vendorTest === false).length,
    visits: selected.filter((r) => r.clickedAt).length,
    recordViews: selected.filter((r) => r.recordViewedAt).length,
    filingStarts: 0,
    checkouts: 0,
    paid: 0,
    serviceRevenueCents: 0,
    stripeFeesCents: 0,
  };
  if (!ids.length) return funnel;
  const [{ data: filings }, { data: orders }] = await Promise.all([
    db.from("filings").select("business_id").in("business_id", ids),
    db.from("orders").select("id, business_id, paid_at, payment_mode, service_fee_cents, total_cents").in("business_id", ids),
  ]);
  funnel.filingStarts = new Set((filings ?? []).map((f) => f.business_id)).size;
  funnel.checkouts = new Set((orders ?? []).map((o) => o.business_id)).size;
  const live = (orders ?? []).filter((o) => o.paid_at && o.payment_mode === "live");
  funnel.paid = new Set(live.map((o) => o.business_id)).size;
  const orderIds = live.map((o) => o.id as string);
  const { data: refunds } = orderIds.length
    ? await db.from("refunds").select("service_fee_cents").in("order_id", orderIds).eq("status", "succeeded")
    : { data: [] as { service_fee_cents: number }[] };
  const refunded = (refunds ?? []).reduce((s, r) => s + Number(r.service_fee_cents ?? 0), 0);
  funnel.serviceRevenueCents = live.reduce((s, o) => s + Number(o.service_fee_cents ?? 0), 0) - refunded;
  funnel.stripeFeesCents = live.reduce((s, o) => s + Math.round(Number(o.total_cents ?? 0) * 0.029 + 30), 0);
  return funnel;
}

/** Record a funnel event for the piece a landing code points at (service role; idempotent). */
export async function markMailEvent(code: { campaignShort: string; entityNumber: string }, event: "visit" | "record_viewed" | "started", businessId?: string) {
  await createAdminClient().rpc("mark_mail_event", {
    p_campaign_short: code.campaignShort,
    p_entity_number: code.entityNumber,
    p_event: event,
    p_business_id: businessId ?? null,
  });
}

/** The landing code the visitor arrived with, verified, if it matches this entity. */
export async function mailAttributionFor(entityNumber: string | null | undefined) {
  if (!entityNumber) return null;
  const { cookies } = await import("next/headers");
  const { MAIL_COOKIE, verifyLandingCode } = await import("./mail-codes");
  const code = (await cookies()).get(MAIL_COOKIE)?.value;
  const v = code ? verifyLandingCode(code) : null;
  return v && v.entityNumber === entityNumber.replace(/\D/g, "").padStart(10, "0") ? v : null;
}

const COHORT_COLUMNS = [
  "selected",
  "exclusion_reason",
  "business_name",
  "entity_number",
  "entity_type",
  "mailing_address_line1",
  "mailing_address_line2",
  "mailing_city",
  "mailing_state",
  "mailing_zip",
  "county",
  "report_year",
  "deadline",
  "landing_url",
  "landing_code",
  "source",
  "source_url",
  "retrieved_at",
  "campaign_id",
] as const;

export function cohortCsv(campaignId: string, rows: CohortRow[], reasonText: (r: string) => string): string {
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [COHORT_COLUMNS.join(",")];
  for (const r of rows) {
    const a = r.address ?? {};
    lines.push(
      [
        r.selected ? "yes" : "no",
        r.reasons.map(reasonText).join("; "),
        r.businessName,
        r.entityNumber,
        r.entityTypeLabel,
        a.line1 ?? "",
        a.line2 ?? "",
        a.city ?? "",
        (a.region ?? "").toUpperCase(),
        (a.postal_code ?? "").replace(/-0*$/, ""),
        a.county ?? "",
        r.periodYear ?? "",
        r.deadline,
        r.landingUrl ?? "",
        r.landingCode ?? "",
        r.source,
        r.sourceUrl ?? "",
        r.retrievedAt,
        campaignId,
      ]
        .map(cell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
