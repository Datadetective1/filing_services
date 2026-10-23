import "server-only";
import type { StateStatus } from "@/lib/domain/government-fees";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The state's own status for an entity, ONLY from an official record with a timestamp
 * (e.g. an operator's export from Washington's CCFS advanced search). Never derived from
 * dates, never customer-reported. Records older than MAX_AGE_DAYS are ignored because a
 * status can change.
 */

export const OFFICIAL_STATUS_SOURCES = ["wa_ccfs_export", "nv_official_export", "ut_official_export"] as const;
export const MAX_STATUS_AGE_DAYS = 14;
/** Clock skew tolerated on a record's timestamp; anything later is treated as invalid. */
const FUTURE_SKEW_MS = 36 * 3_600_000;

/**
 * The one official source whose status may be read for each state. A record from another
 * state's source never counts. Utah is deliberately absent: its $10 late renewal fee is
 * keyed by Filewell to a "Delinquent" label the Division's sources don't use (they print a
 * per-renewal "Late Date"), so no Utah status may trigger a charge until the Division
 * confirms how its record shows a late renewal (see open question ut_sb40_operations).
 */
export const STATUS_SOURCE_BY_STATE: Partial<Record<string, (typeof OFFICIAL_STATUS_SOURCES)[number]>> = {
  WA: "wa_ccfs_export",
  NV: "nv_official_export",
};

export function normalizeEntityNumber(stateCode: string, raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!v) return null;
  if (stateCode === "WA") return v.replace(/\D/g, "").padStart(9, "0").slice(-9);
  return v;
}

export async function knownStateStatus(stateCode: string, entityNumber: string | null, now = new Date()): Promise<StateStatus | null> {
  const num = normalizeEntityNumber(stateCode, entityNumber);
  const source = STATUS_SOURCE_BY_STATE[stateCode.toUpperCase()];
  if (!num || !source) return null;
  try {
    const since = new Date(now.getTime() - MAX_STATUS_AGE_DAYS * 86_400_000).toISOString();
    const latest = new Date(now.getTime() + FUTURE_SKEW_MS).toISOString();
    const { data } = await createAdminClient()
      .from("state_entity_records")
      .select("status_raw, status_checked_at, source")
      .eq("state_code", stateCode)
      .eq("entity_number", num)
      .eq("source", source)
      .not("status_raw", "is", null)
      .gte("status_checked_at", since)
      .lte("status_checked_at", latest)
      .order("status_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.status_raw || !data.status_checked_at) return null;
    // Belt and braces: a wrong-state source or a future-dated record never counts.
    if (data.source !== source) return null;
    const checked = Date.parse(String(data.status_checked_at));
    if (!Number.isFinite(checked) || checked > now.getTime() + FUTURE_SKEW_MS || checked < now.getTime() - MAX_STATUS_AGE_DAYS * 86_400_000) return null;
    return { value: String(data.status_raw), source: String(data.source), checkedAt: String(data.status_checked_at) };
  } catch {
    return null;
  }
}
