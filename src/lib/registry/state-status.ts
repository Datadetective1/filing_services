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

export function normalizeEntityNumber(stateCode: string, raw: string | null | undefined): string | null {
  const v = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!v) return null;
  if (stateCode === "WA") return v.replace(/\D/g, "").padStart(9, "0").slice(-9);
  return v;
}

export async function knownStateStatus(stateCode: string, entityNumber: string | null, now = new Date()): Promise<StateStatus | null> {
  const num = normalizeEntityNumber(stateCode, entityNumber);
  if (!num || stateCode === "PA") return null;
  try {
    const since = new Date(now.getTime() - MAX_STATUS_AGE_DAYS * 86_400_000).toISOString();
    const { data } = await createAdminClient()
      .from("state_entity_records")
      .select("status_raw, status_checked_at, source")
      .eq("state_code", stateCode)
      .eq("entity_number", num)
      .in("source", [...OFFICIAL_STATUS_SOURCES])
      .not("status_raw", "is", null)
      .gte("status_checked_at", since)
      .order("status_checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.status_raw || !data.status_checked_at) return null;
    return { value: String(data.status_raw), source: String(data.source), checkedAt: String(data.status_checked_at) };
  } catch {
    return null;
  }
}
