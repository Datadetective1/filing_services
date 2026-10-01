import "server-only";
import { findRule } from "@/lib/compliance/registry";
import { compareISODate, daysBetween, todayInTimeZone } from "@/lib/domain/dates";
import { dueDateForYear } from "@/lib/domain/deadlines";
import { ENTITY_TYPES, type EntityType } from "@/lib/domain/types";
import { isAgentLine, looksLikePersonalName } from "@/lib/outreach/mail";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Founder research list: a short daily list of Pennsylvania businesses from the public
 * register for Amary to research BY HAND (website, contact page, business phone, company
 * profile) and log what happened.
 *
 * This module never sends anything and never looks up or stores personal contact details:
 * it has no email, SMS or mail code, and only stores what the operator types. It never
 * claims a business is unfiled or behind: the register has no filing status.
 */

const db = () => createAdminClient();
const TZ = "America/New_York";
export const DAILY_LIST_SIZE = 20;

export const PROSPECT_STATUSES = [
  "to_research",
  "researched",
  "no_public_contact",
  "contacted",
  "responded",
  "not_interested",
  "interested",
  "converted",
  "skipped",
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];
export const CHANNELS = ["phone", "contact_form", "linkedin", "in_person", "email_reply", "other"] as const;

/** Entity types ordered by how soon their next Pennsylvania due date is (soonest first). */
export function typesByNextDeadline(today: string): { type: EntityType; dueDate: string; days: number }[] {
  const year = Number(today.slice(0, 4));
  const out: { type: EntityType; dueDate: string; days: number }[] = [];
  for (const type of ENTITY_TYPES) {
    const rule = findRule("PA", type);
    if (!rule || rule.verificationStatus !== "verified") continue;
    let due = dueDateForYear(rule.dueRule, year);
    if (due && compareISODate(due, today) < 0) due = dueDateForYear(rule.dueRule, year + 1);
    if (due) out.push({ type, dueDate: due, days: daysBetween(today, due) });
  }
  return out.sort((a, b) => a.days - b.days);
}

function hashOrder(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

interface CandidateRow {
  id: string;
  entity_number: string;
  legal_name: string;
  entity_type: EntityType | null;
  formation_date: string | null;
  registered_office: { line1?: string; line2?: string } | null;
}

/** Why a register row is not put on the research list (null = eligible). */
export function researchExclusion(row: Pick<CandidateRow, "legal_name" | "formation_date" | "registered_office">, todayYear: number): string | null {
  if (looksLikePersonalName(row.legal_name)) return "personal_name";
  if (row.formation_date && Number(row.formation_date.slice(0, 4)) >= todayYear) return "first_year";
  const a = row.registered_office;
  if (a && (isAgentLine(a.line1) || isAgentLine(a.line2))) return "agent_address";
  return null;
}

/**
 * Today's list (idempotent): returns the rows already chosen today, topping up to `size`
 * from register records whose filing period is approaching. Skips existing customers,
 * businesses in a mail pilot cohort, anything already researched, personal names,
 * agent addresses and first-year entities.
 */
export async function ensureDailyList(size = DAILY_LIST_SIZE, now = new Date()): Promise<{ date: string; added: number; available: number }> {
  const today = todayInTimeZone(TZ, now);
  const { count: existing } = await db().from("founder_prospects").select("id", { count: "exact", head: true }).eq("list_date", today);
  const need = size - (existing ?? 0);
  if (need <= 0) return { date: today, added: 0, available: 0 };

  const types = typesByNextDeadline(today);
  const soonest = types[0]?.dueDate;
  const priority = types.filter((t) => t.dueDate === soonest).map((t) => t.type);

  const [{ data: taken }, { data: cohort }, { data: customers }] = await Promise.all([
    db().from("founder_prospects").select("state_entity_record_id").limit(20000),
    db().from("marketing_sends").select("prospects!inner(state_entity_record_id)").eq("selected", true).limit(20000),
    db().from("businesses").select("state_entity_number").eq("state_code", "PA").not("state_entity_number", "is", null).limit(20000),
  ]);
  const skipIds = new Set<string>((taken ?? []).map((r) => r.state_entity_record_id as string));
  for (const c of (cohort ?? []) as { prospects: { state_entity_record_id: string } | { state_entity_record_id: string }[] }[]) {
    const p = Array.isArray(c.prospects) ? c.prospects : [c.prospects];
    for (const x of p) skipIds.add(x.state_entity_record_id);
  }
  const customerNumbers = new Set((customers ?? []).map((b) => String(b.state_entity_number).padStart(10, "0")));

  const { data: pool } = await db()
    .from("state_entity_records")
    .select("id, entity_number, legal_name, entity_type, formation_date, registered_office")
    .eq("state_code", "PA")
    .eq("source", "pa_dos_open_data")
    .in("entity_type", priority.length ? priority : [...ENTITY_TYPES])
    .or("is_foreign.is.null,is_foreign.eq.false")
    .limit(5000);
  const year = Number(today.slice(0, 4));
  const eligible = ((pool ?? []) as CandidateRow[])
    .filter((r) => !skipIds.has(r.id) && !customerNumbers.has(r.entity_number.padStart(10, "0")) && !researchExclusion(r, year))
    .sort((a, b) => hashOrder(`${today}:${a.entity_number}`) - hashOrder(`${today}:${b.entity_number}`));
  const chosen = eligible.slice(0, need);
  if (chosen.length) {
    await db()
      .from("founder_prospects")
      .upsert(chosen.map((r) => ({ state_entity_record_id: r.id, list_date: today })), { onConflict: "state_entity_record_id", ignoreDuplicates: true });
  }
  return { date: today, added: chosen.length, available: eligible.length };
}

export interface FounderProspectView {
  id: string;
  listDate: string;
  status: ProspectStatus;
  websiteUrl: string | null;
  contactPageUrl: string | null;
  businessPhone: string | null;
  linkedinUrl: string | null;
  contactedOn: string | null;
  channel: string | null;
  response: string | null;
  interested: boolean | null;
  converted: boolean;
  notes: string | null;
  record: {
    legalName: string;
    entityNumber: string;
    entityType: string | null;
    formationDate: string | null;
    address: string;
    county: string | null;
    sourceUrl: string | null;
  };
}

type Row = Record<string, unknown> & { state_entity_records: Record<string, unknown> | null };

function toView(r: Row): FounderProspectView {
  const rec = r.state_entity_records ?? {};
  const a = (rec.registered_office ?? {}) as Record<string, string | undefined>;
  return {
    id: r.id as string,
    listDate: r.list_date as string,
    status: r.status as ProspectStatus,
    websiteUrl: (r.website_url as string) ?? null,
    contactPageUrl: (r.contact_page_url as string) ?? null,
    businessPhone: (r.business_phone as string) ?? null,
    linkedinUrl: (r.linkedin_url as string) ?? null,
    contactedOn: (r.contacted_on as string) ?? null,
    channel: (r.channel as string) ?? null,
    response: (r.response as string) ?? null,
    interested: (r.interested as boolean | null) ?? null,
    converted: Boolean(r.converted),
    notes: (r.notes as string) ?? null,
    record: {
      legalName: String(rec.legal_name ?? ""),
      entityNumber: String(rec.entity_number ?? ""),
      entityType: (rec.entity_type as string) ?? null,
      formationDate: (rec.formation_date as string) ?? null,
      address: [a.line1, a.line2, [a.city, a.region].filter(Boolean).join(", "), a.postal_code].filter(Boolean).join(", "),
      county: a.county ?? null,
      sourceUrl: (rec.source_url as string) ?? null,
    },
  };
}

const SELECT =
  "id, list_date, status, website_url, contact_page_url, business_phone, linkedin_url, contacted_on, channel, response, interested, converted, notes, state_entity_records(legal_name, entity_number, entity_type, formation_date, registered_office, source_url)";

export async function listFounderProspects(opts: { date?: string; status?: string; limit?: number } = {}): Promise<FounderProspectView[]> {
  let q = db().from("founder_prospects").select(SELECT).order("list_date", { ascending: false }).order("created_at", { ascending: true }).limit(opts.limit ?? 200);
  if (opts.date) q = q.eq("list_date", opts.date);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q;
  return ((data ?? []) as unknown as Row[]).map(toView);
}

export interface ProspectUpdate {
  status: ProspectStatus;
  websiteUrl: string | null;
  contactPageUrl: string | null;
  businessPhone: string | null;
  linkedinUrl: string | null;
  contactedOn: string | null;
  channel: (typeof CHANNELS)[number] | null;
  response: string | null;
  interested: boolean | null;
  converted: boolean;
  notes: string | null;
}

export async function updateFounderProspect(id: string, u: ProspectUpdate, staffId: string): Promise<void> {
  const { error } = await db()
    .from("founder_prospects")
    .update({
      status: u.status,
      website_url: u.websiteUrl,
      contact_page_url: u.contactPageUrl,
      business_phone: u.businessPhone,
      linkedin_url: u.linkedinUrl,
      contacted_on: u.contactedOn,
      channel: u.channel,
      response: u.response,
      interested: u.interested,
      converted: u.converted,
      notes: u.notes,
      updated_by: staffId,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function founderActivity(sinceIso: string): Promise<{ byStatus: Record<string, number>; contactedSince: number; total: number }> {
  const { data } = await db().from("founder_prospects").select("status, contacted_on").limit(20000);
  const byStatus: Record<string, number> = {};
  let contactedSince = 0;
  for (const r of data ?? []) {
    byStatus[r.status as string] = (byStatus[r.status as string] ?? 0) + 1;
    if (r.contacted_on && (r.contacted_on as string) >= sinceIso.slice(0, 10)) contactedSince++;
  }
  return { byStatus, contactedSince, total: (data ?? []).length };
}
