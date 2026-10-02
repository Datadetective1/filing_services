import "server-only";
import { evaluateFees } from "@/lib/compliance/fees";
import { findRule, getJurisdiction } from "@/lib/compliance/registry";
import { NV_URLS } from "@/lib/compliance/states/nevada";
import { UT_URLS } from "@/lib/compliance/states/utah";
import { WA_URLS } from "@/lib/compliance/states/washington";
import { daysBetween, todayInTimeZone } from "@/lib/domain/dates";
import type { GovFeeEvaluation } from "@/lib/domain/government-fees";
import type { EntityType } from "@/lib/domain/types";
import { mapExport } from "@/lib/registry/state-export";
import { MAX_STATUS_AGE_DAYS, normalizeEntityNumber } from "@/lib/registry/state-status";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * October (or any month) opportunity cohorts for the expansion states, built ONLY from an
 * official export an operator downloaded in a browser and uploaded here. Nothing is
 * scraped, bought or contacted. Status-based charges use the export's status and date.
 */

const db = () => createAdminClient();

export const COHORT_STATES = ["WA", "NV", "UT"] as const;

export const EXPORT_SOURCES: Record<string, { source: string; label: string; searchUrl: string; howTo: string; available: boolean }> = {
  WA: {
    source: "wa_ccfs_export",
    label: "Washington CCFS Advanced Search export (CSV)",
    searchUrl: WA_URLS.advancedSearch,
    howTo:
      "In a normal browser, open CCFS Advanced Search, filter by expiration date (e.g. 10/01/2026 to 10/31/2026), business type and status Active/Delinquent, then download the results as CSV and upload the file here.",
    available: true,
  },
  NV: {
    source: "nv_official_export",
    label: "Nevada Secretary of State data report",
    searchUrl: NV_URLS.businessSearch,
    howTo:
      "Nevada's public search is bot-protected and has no free export. The Secretary of State sells custom data reports (reportedly $500/month unlimited). Requires owner approval before any purchase; nothing is loaded today.",
    available: false,
  },
  UT: {
    source: "ut_official_export",
    label: "Utah Division of Corporations business list",
    searchUrl: UT_URLS.registration,
    howTo:
      "Utah's entity search is behind a Cloudflare challenge and its open-data portal is decommissioned. The Division sells business lists ($0.01 per record for a full list). Requires owner approval before any purchase; nothing is loaded today.",
    available: false,
  },
};

export interface ImportSummary {
  imported: number;
  skipped: number;
  unsupportedType: number;
  columns: Record<string, string | null>;
  firstSkips: { line: number; reason: string }[];
}

export async function importStateExport(stateCode: string, csv: string, exportedAt: string): Promise<ImportSummary> {
  const meta = EXPORT_SOURCES[stateCode];
  if (!meta) throw new Error("Unsupported state");
  const parsed = mapExport(csv, { normalizeNumber: (raw) => normalizeEntityNumber(stateCode, raw) });
  const rows = parsed.rows.map((r) => ({
    state_code: stateCode,
    entity_number: r.entityNumber,
    legal_name: r.name,
    entity_type_raw: r.typeRaw || null,
    entity_type: r.entityType,
    is_foreign: r.isForeign,
    status_raw: r.status,
    status_checked_at: exportedAt,
    due_date: r.dueDate,
    formation_date: r.formationDate,
    principal_office: r.address ? { line1: r.address } : null,
    source: meta.source,
    source_url: meta.searchUrl,
    source_licence: "Public record exported by a Filewell operator from the official state search",
    retrieved_at: exportedAt,
    raw: r.raw,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("state_entity_records").upsert(rows.slice(i, i + 500), { onConflict: "state_code,entity_number,source" });
    if (error) throw new Error(error.message);
  }
  return {
    imported: rows.length,
    skipped: parsed.skipped.length,
    unsupportedType: parsed.rows.filter((r) => !r.entityType).length,
    columns: parsed.columns,
    firstSkips: parsed.skipped.slice(0, 5),
  };
}

export interface CohortEntry {
  id: string;
  name: string;
  entityNumber: string;
  entityType: EntityType | null;
  typeRaw: string | null;
  isForeign: boolean | null;
  dueDate: string;
  daysRemaining: number;
  status: string | null;
  statusCheckedAt: string | null;
  statusFresh: boolean;
  supported: boolean;
  fees: GovFeeEvaluation | null;
  /** Verified late charge triggered by the state's own record or a passed verified date. */
  lateTriggered: "yes" | "no" | "unknown";
  source: string;
}

export async function cohortFor(stateCode: string, month: string, now = new Date()): Promise<{ entries: CohortEntry[]; loaded: number }> {
  const meta = EXPORT_SOURCES[stateCode];
  if (!meta || !/^\d{4}-\d{2}$/.test(month)) return { entries: [], loaded: 0 };
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const tz = getJurisdiction(stateCode)?.timezone ?? "America/Los_Angeles";
  const today = todayInTimeZone(tz, now);
  const { count: loaded } = await db().from("state_entity_records").select("id", { count: "exact", head: true }).eq("state_code", stateCode).eq("source", meta.source);
  const { data } = await db()
    .from("state_entity_records")
    .select("id, legal_name, entity_number, entity_type, entity_type_raw, is_foreign, status_raw, status_checked_at, due_date, source")
    .eq("state_code", stateCode)
    .eq("source", meta.source)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true })
    .limit(5000);
  const entries: CohortEntry[] = (data ?? []).map((r) => {
    const entityType = (r.entity_type as EntityType | null) ?? null;
    const rule = entityType ? findRule(stateCode, entityType, "annual_report", Boolean(r.is_foreign)) : undefined;
    const checkedAt = (r.status_checked_at as string | null) ?? null;
    const fresh = Boolean(checkedAt && now.getTime() - new Date(checkedAt).getTime() <= MAX_STATUS_AGE_DAYS * 86_400_000);
    const status = r.status_raw && fresh ? { value: String(r.status_raw), source: String(r.source), checkedAt: checkedAt! } : null;
    const fees = rule
      ? evaluateFees(rule, { isNonprofit: false, dueDate: String(r.due_date), filingDate: today, status, filingThisPeriod: false })
      : null;
    const lateTriggered: CohortEntry["lateTriggered"] = !fees
      ? "unknown"
      : fees.due.some((l) => l.kind === "government_late_fee")
        ? "yes"
        : fees.possible.length
          ? "unknown"
          : "no";
    return {
      id: String(r.id),
      name: String(r.legal_name),
      entityNumber: String(r.entity_number),
      entityType,
      typeRaw: (r.entity_type_raw as string | null) ?? null,
      isForeign: (r.is_foreign as boolean | null) ?? null,
      dueDate: String(r.due_date),
      daysRemaining: daysBetween(today, String(r.due_date)),
      status: (r.status_raw as string | null) ?? null,
      statusCheckedAt: checkedAt,
      statusFresh: fresh,
      supported: Boolean(rule),
      fees,
      lateTriggered,
      source: String(r.source),
    };
  });
  return { entries, loaded: loaded ?? 0 };
}
