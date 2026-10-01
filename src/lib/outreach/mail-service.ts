import "server-only";
import { site } from "@/config/site";
import { findRule } from "@/lib/compliance/registry";
import { todayInTimeZone } from "@/lib/domain/dates";
import type { EntityType } from "@/lib/domain/types";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { PA_OPEN_DATA } from "@/lib/registry/pa-open-data-map";
import { createAdminClient } from "@/lib/supabase/admin";
import { addressKey, formatMailAddress, MAIL_EXCLUSION_TEXT, mailExclusions, type MailExclusion, type RecordAddress } from "./mail";
import { landingCode, landingUrl } from "./mail-codes";
import { postcardCopy } from "./postcard";
import { assessSituation, type Situation } from "./segment";

/**
 * Builds the December 31 postcard pilot from imported prospects: who would get a card,
 * who is excluded and why, with provenance and a unique landing URL per piece. Nothing
 * is purchased or sent: there is no vendor integration in the code. Real mailing would
 * need an approved campaign, a return address, an approved vendor and MAIL_SENDS_ENABLED.
 */

export type MailGate = "campaign_not_approved" | "no_return_address" | "no_mail_vendor" | "mail_sends_disabled";

export const MAIL_GATE_TEXT: Record<MailGate, string> = {
  campaign_not_approved: "Campaign not approved",
  no_return_address: "No return address (MAIL_RETURN_ADDRESS or a public postal address) configured",
  no_mail_vendor: "No mail vendor approved and connected (MAIL_VENDOR)",
  mail_sends_disabled: "Real mailing is switched off (MAIL_SENDS_ENABLED)",
};

export function returnAddress(): string | null {
  return process.env.MAIL_RETURN_ADDRESS?.trim() || site.postalAddress || null;
}

export function mailGates(campaign: { status: string }): MailGate[] {
  const out: MailGate[] = [];
  if (campaign.status !== "approved") out.push("campaign_not_approved");
  if (!returnAddress()) out.push("no_return_address");
  if (!process.env.MAIL_VENDOR?.trim()) out.push("no_mail_vendor");
  if (process.env.MAIL_SENDS_ENABLED !== "true") out.push("mail_sends_disabled");
  return out;
}

export interface MailRow {
  prospectId: string;
  businessName: string;
  entityNumber: string;
  entityType: EntityType | null;
  isForeign: boolean | null;
  addressCount: number;
  entityTypeLabel: string;
  typeRaw: string | null;
  address: RecordAddress | null;
  mailingAddress: string;
  county: string;
  situation: Situation;
  deadline: string;
  periodYear: number | null;
  source: string;
  sourceUrl: string | null;
  retrievedAt: string;
  exclusions: MailExclusion[];
  included: boolean;
  landingCode: string | null;
  landingUrl: string | null;
}

interface Joined {
  id: string;
  converted_business_id: string | null;
  state_entity_records: {
    legal_name: string;
    entity_number: string;
    entity_type: string | null;
    entity_type_raw: string | null;
    is_foreign: boolean | null;
    formation_date: string | null;
    registered_office: RecordAddress | null;
    annual_reports: { year: number }[] | null;
    source: string;
    source_url: string | null;
    retrieved_at: string;
  };
}

export async function buildMailPilot(campaignId: string, opts: { persist: boolean }): Promise<MailRow[]> {
  const db = createAdminClient();
  const today = todayInTimeZone("America/New_York");
  const { data } = await db
    .from("prospects")
    .select(
      "id, converted_business_id, state_entity_records!inner(legal_name, entity_number, entity_type, entity_type_raw, is_foreign, formation_date, registered_office, annual_reports, source, source_url, retrieved_at)",
    )
    .eq("state_code", "PA")
    .order("created_at", { ascending: true })
    .limit(10000);
  const prospects = (data ?? []) as unknown as Joined[];

  // Customers by entity number (also catches businesses added after the import).
  const numbers = prospects.map((p) => p.state_entity_records.entity_number);
  const customerNumbers = new Set<string>();
  for (let i = 0; i < numbers.length; i += 500) {
    const { data: biz } = await db.from("businesses").select("state_entity_number").eq("state_code", "PA").in("state_entity_number", numbers.slice(i, i + 500));
    for (const b of biz ?? []) if (b.state_entity_number) customerNumbers.add(b.state_entity_number as string);
  }

  const keyCounts = new Map<string, number>();
  for (const p of prospects) {
    const k = addressKey(p.state_entity_records.registered_office);
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }

  const rows: MailRow[] = prospects.map((p) => {
    const r = p.state_entity_records;
    const entityType = (r.entity_type as EntityType | null) ?? null;
    const situation = assessSituation({
      stateCode: "PA",
      entityType,
      isForeign: r.is_foreign,
      formationDate: r.formation_date,
      filedYears: r.annual_reports ? r.annual_reports.map((a) => a.year) : null,
      statusSource: r.source,
      today,
    });
    const k = addressKey(r.registered_office);
    const exclusions = mailExclusions({
      entityType,
      address: r.registered_office,
      situation,
      isCustomer: Boolean(p.converted_business_id) || customerNumbers.has(r.entity_number),
      sharedCount: k ? (keyCounts.get(k) ?? 0) : 0,
    });
    const included = exclusions.length === 0;
    const code = included ? landingCode(campaignId, r.entity_number) : null;
    return {
      prospectId: p.id,
      businessName: r.legal_name,
      entityNumber: r.entity_number,
      entityType,
      isForeign: r.is_foreign,
      addressCount: k ? (keyCounts.get(k) ?? 0) : 0,
      entityTypeLabel: entityType ? `${r.is_foreign ? "Foreign " : ""}${ENTITY_TYPE_LABELS[entityType]}` : (r.entity_type_raw ?? "Unknown"),
      typeRaw: r.entity_type_raw,
      address: r.registered_office,
      mailingAddress: r.registered_office?.line1 ? formatMailAddress(r.registered_office) : "",
      county: r.registered_office?.county ?? "",
      situation,
      deadline: situation.kind === "assessed" ? situation.dueDate : "",
      periodYear: situation.kind === "assessed" ? situation.periodYear : null,
      source: r.source === PA_OPEN_DATA.sourceName ? PA_OPEN_DATA.sourceLabel : r.source,
      sourceUrl: r.source_url,
      retrievedAt: r.retrieved_at,
      exclusions,
      included,
      landingCode: code,
      landingUrl: code ? landingUrl(code) : null,
    };
  });

  if (opts.persist && rows.length) {
    await db.from("marketing_sends").delete().eq("campaign_id", campaignId).eq("status", "dry_run");
    for (let i = 0; i < rows.length; i += 500) {
      await db.from("marketing_sends").upsert(
        rows.slice(i, i + 500).map((r) => ({
          campaign_id: campaignId,
          prospect_id: r.prospectId,
          status: "dry_run",
          reasons: r.exclusions,
          landing_code: r.landingCode,
        })),
        { onConflict: "campaign_id,prospect_id" },
      );
    }
  }
  return rows;
}

export function postcardForRow(r: Pick<MailRow, "businessName" | "entityType" | "periodYear" | "landingUrl">) {
  const rule = r.entityType ? findRule("PA", r.entityType) : findRule("PA", "lp");
  return postcardCopy({
    businessName: r.businessName,
    periodYear: r.periodYear ?? Number(todayInTimeZone("America/New_York").slice(0, 4)),
    stateFeeCents: rule?.stateFeeCents ?? 700,
    nonprofitStateFeeCents: rule?.nonprofitStateFeeCents ?? null,
    serviceFeeCents: 4900,
    landingUrl: r.landingUrl ?? "https://www.getfilewell.com/m/xxxxxxxx",
    operator: site.legalEntityConfigured ? site.legalEntity : "Filewell",
    returnAddress: returnAddress(),
  });
}

const CSV_COLUMNS = [
  "included",
  "exclusion_reason",
  "business_name",
  "entity_number",
  "entity_type",
  "registration_type_on_record",
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

/** Spreadsheet-safe CSV cell: quoted, and formula-leading characters neutralized. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function mailCsv(campaignId: string, rows: MailRow[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) {
    const a = r.address ?? {};
    lines.push(
      [
        r.included ? "yes" : "no",
        r.exclusions.map((x) => MAIL_EXCLUSION_TEXT[x]).join("; "),
        r.businessName,
        r.entityNumber,
        r.entityTypeLabel,
        r.typeRaw ?? "",
        a.line1 ?? "",
        a.line2 ?? "",
        a.city ?? "",
        (a.region ?? "").toUpperCase(),
        (a.postal_code ?? "").replace(/-0*$/, ""),
        r.county,
        r.periodYear ?? "",
        r.deadline,
        r.landingUrl ?? "",
        r.landingCode ?? "",
        r.source,
        r.sourceUrl ?? "",
        r.retrievedAt,
        campaignId,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
