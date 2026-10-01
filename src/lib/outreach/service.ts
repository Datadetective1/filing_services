import "server-only";
import { absoluteUrl, site } from "@/config/site";
import { findRule } from "@/lib/compliance/registry";
import { todayInTimeZone } from "@/lib/domain/dates";
import { mapRegistrationType, PA_OPEN_DATA, type PaOpenDataRow, soqlString, tidyBusinessName } from "@/lib/registry/pa-open-data-map";
import { RegistryUnavailableError } from "@/lib/registry/pa-open-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { contentSha256, renderOutreachEmail } from "./email";
import { campaignGates, decide, type GateConfig, recipientGates } from "./gate";
import { outreachUnsubscribeToken } from "./unsubscribe";
import { assessSituation, type CampaignSegment, type EntityGroup, type Situation } from "./segment";

/**
 * Prospect outreach: import businesses from the official open register, assess each one's
 * annual-report situation, and DRY-RUN campaigns through the compliance gate.
 *
 * There is deliberately no send path in this module. Real sending would need an owner-
 * approved marketing provider (Resend forbids cold outreach), a public postal address and
 * MARKETING_SENDS_ENABLED=true; the gate reports those as blockers on every dry run.
 */

const PA_TYPES: Record<EntityGroup, string[]> = {
  llc: ["Domestic Limited Liability Company", "Foreign Limited Liability Company"],
  corporation: ["Domestic Business Corporation", "Foreign Business Corporation", "Domestic Nonprofit Corporation", "Foreign Nonprofit Corporation"],
  other: ["Domestic Limited Partnership (LP/LLLP)", "Foreign Limited Partnership", "Foreign Limited Liability General Partnership", "Domestic Business Trust", "Foreign Business Trust", "Foreign Professional Association", "Domestic Professional Association"],
};

export function gateConfig(): GateConfig {
  return {
    postalAddress: site.postalAddress,
    marketingProvider: process.env.MARKETING_EMAIL_PROVIDER?.trim() || null,
    marketingFrom: process.env.MARKETING_EMAIL_FROM?.trim() || null,
    sendsEnabled: process.env.MARKETING_SENDS_ENABLED === "true",
  };
}

/**
 * Import up to `limit` businesses of one entity group (optionally one county) from the
 * Department of State open dataset. Business-level fields only: no person names are
 * stored for prospects. Idempotent (upserts on entity number).
 */
export async function importPaProspects(opts: { group: EntityGroup; county: string | null; limit: number; offset: number }): Promise<{ imported: number; customers: number }> {
  const limit = Math.max(1, Math.min(500, Math.floor(opts.limit)));
  const types = PA_TYPES[opts.group].map(soqlString).join(", ");
  const county = opts.county?.replace(/[^A-Za-z .'-]/g, "").trim() || null;
  const cols = "filing_number, business_name, typeofbusinessregistration, address_line1, address_line2, city, state, zip, shortcountyname, creationdate";
  const url = new URL(`${PA_OPEN_DATA.host}/resource/${PA_OPEN_DATA.detailDataset}.json`);
  url.searchParams.set("$select", cols);
  url.searchParams.set("$where", `typeofbusinessregistration in (${types})${county ? ` AND shortcountyname = ${soqlString(county)}` : ""}`);
  url.searchParams.set("$group", cols);
  url.searchParams.set("$order", "filing_number");
  url.searchParams.set("$limit", String(limit));
  url.searchParams.set("$offset", String(Math.max(0, Math.floor(opts.offset))));
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "Filewell (support@getfilewell.com)" };
  if (process.env.SOCRATA_APP_TOKEN) headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
  let rows: PaOpenDataRow[];
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) throw new RegistryUnavailableError(`data.pa.gov returned ${res.status}`);
    rows = (await res.json()) as PaOpenDataRow[];
  } catch (e) {
    throw e instanceof RegistryUnavailableError ? e : new RegistryUnavailableError("data.pa.gov didn't respond");
  }

  const db = createAdminClient();
  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const records = rows
    .filter((r) => r.filing_number && r.business_name && !seen.has(r.filing_number) && seen.add(r.filing_number))
    .map((r) => {
      const t = mapRegistrationType(r.typeofbusinessregistration);
      const created = (r.creationdate ?? "").slice(0, 10);
      return {
        state_code: "PA",
        entity_number: r.filing_number!.trim(),
        legal_name: tidyBusinessName(r.business_name),
        entity_type_raw: r.typeofbusinessregistration ?? null,
        entity_type: t.entityType,
        is_foreign: t.isForeign,
        formation_date: /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : null,
        jurisdiction_of_formation: t.isForeign === false ? "Pennsylvania" : null,
        registered_office: r.address_line1
          ? { line1: r.address_line1, line2: r.address_line2 ?? "", city: r.city ?? "", region: r.state ?? "", postal_code: r.zip ?? "", county: r.shortcountyname ?? "" }
          : null,
        annual_reports: null,
        source: PA_OPEN_DATA.sourceName,
        source_url: `${PA_OPEN_DATA.datasetUrl}?filing_number=${encodeURIComponent(r.filing_number!.trim())}`,
        source_licence: PA_OPEN_DATA.licence,
        retrieved_at: retrievedAt,
      };
    });
  if (!records.length) return { imported: 0, customers: 0 };

  const { data: saved, error } = await db
    .from("state_entity_records")
    .upsert(records, { onConflict: "state_code,entity_number,source" })
    .select("id, entity_number");
  if (error) throw new Error(`import failed: ${error.message}`);

  // Businesses that are already Filewell customers are linked, and never marketed to.
  const numbers = (saved ?? []).map((s) => s.entity_number as string);
  const { data: customers } = await db.from("businesses").select("id, state_entity_number").eq("state_code", "PA").in("state_entity_number", numbers);
  const customerBy = new Map((customers ?? []).map((c) => [c.state_entity_number as string, c.id as string]));
  const { error: pErr } = await db.from("prospects").upsert(
    (saved ?? []).map((s) => ({ state_entity_record_id: s.id, state_code: "PA", converted_business_id: customerBy.get(s.entity_number as string) ?? null })),
    { onConflict: "state_entity_record_id" },
  );
  if (pErr) throw new Error(`prospect upsert failed: ${pErr.message}`);
  return { imported: saved?.length ?? 0, customers: customerBy.size };
}

interface ProspectRow {
  id: string;
  converted_business_id: string | null;
  state_entity_records: {
    legal_name: string;
    entity_number: string;
    entity_type: string | null;
    is_foreign: boolean | null;
    formation_date: string | null;
    annual_reports: { year: number }[] | null;
    source: string | null;
  };
  contact_points: { id: string; kind: string; value: string; source: string | null; licence_use: string; is_business_contact: boolean }[];
}

export interface DryRunRecipient {
  prospectId: string;
  businessName: string;
  entityNumber: string;
  entityType: string | null;
  isForeign: boolean | null;
  situation: Situation;
  recordSource: string | null;
  email: string | null;
  emailSource: string | null;
  reasons: string[];
  wouldSend: boolean;
}

export interface CampaignRow {
  id: string;
  name: string;
  segment: CampaignSegment;
  entity_group: EntityGroup | "all";
  subject: string;
  status: string;
  approved_content_sha256: string | null;
  approved_at: string | null;
}

/** Evaluate every PA prospect for a campaign and record the dry-run result per prospect. */
export async function dryRunCampaign(campaign: CampaignRow, opts: { persist: boolean; maxProspects?: number } = { persist: true }) {
  const db = createAdminClient();
  const today = todayInTimeZone("America/New_York");
  const cfg = gateConfig();
  const currentSha = contentSha256({ subject: campaign.subject, segment: campaign.segment, entityGroup: campaign.entity_group });
  const cGates = campaignGates(
    { status: campaign.status, approvedContentSha256: campaign.approved_content_sha256, currentContentSha256: currentSha, segment: campaign.segment, entityGroup: campaign.entity_group },
    cfg,
  );

  const { data } = await db
    .from("prospects")
    .select(
      "id, converted_business_id, state_entity_records!inner(legal_name, entity_number, entity_type, is_foreign, formation_date, annual_reports, source), contact_points(id, kind, value, source, licence_use, is_business_contact)",
    )
    .eq("state_code", "PA")
    .order("created_at", { ascending: true })
    .limit(Math.min(opts.maxProspects ?? 5000, 5000));
  const prospects = (data ?? []) as unknown as ProspectRow[];

  const emails = prospects.flatMap((p) => p.contact_points.filter((c) => c.kind === "email").map((c) => c.value.toLowerCase()));
  const { data: sup } = emails.length ? await db.from("marketing_suppressions").select("email").in("email", emails) : { data: [] };
  const suppressed = new Set((sup ?? []).map((s) => s.email as string));

  const recipients: DryRunRecipient[] = prospects.map((p) => {
    const rec = p.state_entity_records;
    const situation = assessSituation({
      stateCode: "PA",
      entityType: (rec.entity_type as never) ?? null,
      isForeign: rec.is_foreign,
      formationDate: rec.formation_date,
      filedYears: rec.annual_reports ? rec.annual_reports.map((a) => a.year) : null,
      statusSource: rec.source,
      today,
    });
    const email = p.contact_points.find((c) => c.kind === "email") ?? null;
    const rGates = recipientGates(
      { segment: campaign.segment, entityGroup: campaign.entity_group },
      {
        recordSource: rec.source,
        situation,
        email: email ? { value: email.value, source: email.source, licenceUse: email.licence_use, isBusinessContact: email.is_business_contact } : null,
        suppressed: email ? suppressed.has(email.value.toLowerCase()) : false,
        isCustomer: Boolean(p.converted_business_id),
      },
    );
    const d = decide(cGates, rGates);
    return {
      prospectId: p.id,
      businessName: rec.legal_name,
      entityNumber: rec.entity_number,
      entityType: rec.entity_type,
      isForeign: rec.is_foreign,
      situation,
      recordSource: rec.source,
      email: email?.value ?? null,
      emailSource: email?.source ?? null,
      reasons: d.reasons,
      wouldSend: d.send,
    };
  });

  if (opts.persist && recipients.length) {
    await db.from("marketing_sends").delete().eq("campaign_id", campaign.id).eq("status", "dry_run");
    for (let i = 0; i < recipients.length; i += 500) {
      await db.from("marketing_sends").upsert(
        recipients.slice(i, i + 500).map((r) => ({
          campaign_id: campaign.id,
          prospect_id: r.prospectId,
          email: r.email?.toLowerCase() ?? null,
          status: "dry_run",
          reasons: r.reasons,
        })),
        { onConflict: "campaign_id,prospect_id" },
      );
    }
  }
  return { campaignGates: cGates, recipients, currentSha };
}

/** The exact email a recipient would get (for the admin preview). */
export function previewEmail(campaign: CampaignRow, r: Pick<DryRunRecipient, "businessName" | "situation" | "email" | "entityType" | "isForeign">) {
  const s = r.situation;
  const rule = r.entityType ? findRule("PA", r.entityType as never, "annual_report", Boolean(r.isForeign)) : null;
  const unsubscribeUrl = absoluteUrl(`/outreach/unsubscribe?t=${encodeURIComponent(outreachUnsubscribeToken(r.email ?? "preview@example.com"))}`);
  return renderOutreachEmail({
    subject: campaign.subject,
    businessName: r.businessName,
    segment: campaign.segment,
    periodYear: s.kind === "assessed" ? s.periodYear : new Date().getFullYear(),
    dueDate: s.kind === "assessed" ? s.dueDate : "2026-09-30",
    stateFeeCents: rule?.stateFeeCents ?? 0,
    nonprofitStateFeeCents: rule?.nonprofitStateFeeCents ?? null,
    serviceFeeCents: 4900,
    ctaUrl: absoluteUrl("/find?utm_source=outreach"),
    unsubscribeUrl,
    postalAddress: site.postalAddress,
    senderName: site.legalEntityConfigured ? `Filewell (${site.legalEntity})` : "Filewell",
  });
}

export { suppressEmail } from "./suppression";

export async function outreachStats() {
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [records, prospects, customers, withEmail, suppressed, campaigns, sends] = await Promise.all([
    db.from("state_entity_records").select("id", head).eq("state_code", "PA"),
    db.from("prospects").select("id", head).eq("state_code", "PA"),
    db.from("prospects").select("id", head).eq("state_code", "PA").not("converted_business_id", "is", null),
    db.from("contact_points").select("id", head).eq("kind", "email"),
    db.from("marketing_suppressions").select("email", head),
    db.from("marketing_campaigns").select("id, name, segment, entity_group, subject, status, approved_content_sha256, approved_at, created_at, channel").order("created_at", { ascending: false }),
    db.from("marketing_sends").select("campaign_id, status, clicked_at, converted_business_id, revenue_cents, reasons"),
  ]);
  const rows = (sends.data ?? []) as { campaign_id: string; status: string; clicked_at: string | null; converted_business_id: string | null; revenue_cents: number; reasons: string[] }[];
  const by = (status: string) => rows.filter((r) => r.status === status).length;
  return {
    records: records.count ?? 0,
    prospects: prospects.count ?? 0,
    customers: customers.count ?? 0,
    withEmail: withEmail.count ?? 0,
    suppressed: suppressed.count ?? 0,
    eligibleInLastDryRun: rows.filter((r) => r.status === "dry_run" && r.reasons.length === 0).length,
    queued: by("queued"),
    sent: by("sent"),
    clicked: rows.filter((r) => r.clicked_at).length,
    started: rows.filter((r) => r.converted_business_id).length,
    revenueCents: rows.reduce((s, r) => s + (r.revenue_cents ?? 0), 0),
    campaigns: (campaigns.data ?? []) as (CampaignRow & { created_at: string; channel: string })[],
    sendsByCampaign: rows,
  };
}
