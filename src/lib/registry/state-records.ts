import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PA_OPEN_DATA, type RegistryDetail } from "./pa-open-data-map";
import { getStateRecord } from "./state-open-data";
import { STATE_DATASETS } from "./state-open-data-map";

/**
 * state_entity_records is written ONLY here, by the server, from data it fetched itself.
 * It is service-role only, so a "came from the state's register" claim can never rest on
 * anything a customer could edit (unlike businesses.registry_record).
 */

/** Where each state's saved record came from. Pennsylvania keeps its original source name. */
export function recordSource(stateCode: string, entityNumber: string): { name: string; url: string; licence: string } {
  const ds = STATE_DATASETS[stateCode.toUpperCase()];
  if (!ds) {
    return {
      name: PA_OPEN_DATA.sourceName,
      url: `${PA_OPEN_DATA.datasetUrl}?filing_number=${encodeURIComponent(entityNumber)}`,
      licence: PA_OPEN_DATA.licence,
    };
  }
  return {
    name: `${ds.code.toLowerCase()}_open_data`,
    url: `${ds.host}/resource/${ds.dataset}.json?${ds.numberField}=${encodeURIComponent(entityNumber)}`,
    licence: `Official open dataset published for public reuse (${new URL(ds.host).host})`,
  };
}

export interface StoredStateRecord {
  id: string;
  retrievedAt: string;
  sourceUrl: string;
  detail: RegistryDetail;
}

export async function saveStateRecord(stateCode: string, detail: RegistryDetail): Promise<StoredStateRecord> {
  const retrievedAt = new Date().toISOString();
  const source = recordSource(stateCode, detail.entityNumber);
  const sourceUrl = source.url;
  const { data, error } = await createAdminClient()
    .from("state_entity_records")
    .upsert(
      {
        state_code: stateCode,
        entity_number: detail.entityNumber,
        legal_name: detail.name,
        entity_type_raw: detail.typeRaw || null,
        entity_type: detail.entityType,
        is_foreign: detail.isForeign,
        formation_date: detail.formationDate,
        jurisdiction_of_formation: detail.jurisdictionOfFormation,
        registered_office: detail.addressOnRecord ?? detail.agent?.address ?? null,
        principal_office: detail.principalAddress ?? null,
        governors: detail.governors,
        officers: detail.officers,
        annual_reports: null, // the open dataset does not publish filing history
        source: source.name,
        source_url: sourceUrl,
        source_licence: source.licence,
        retrieved_at: retrievedAt,
        raw: detail,
      },
      { onConflict: "state_code,entity_number,source" },
    )
    .select("id")
    .single();
  if (error || !data) throw new Error(`state record save failed: ${error?.message ?? "unknown"}`);
  return { id: data.id as string, retrievedAt, sourceUrl, detail };
}

/** The register record for a business's entity number, if the server saved one. */
export async function loadStateRecord(stateCode: string, entityNumber: string | null): Promise<StoredStateRecord | null> {
  if (!entityNumber) return null;
  const { data } = await createAdminClient()
    .from("state_entity_records")
    .select("id, retrieved_at, source_url, raw")
    .eq("state_code", stateCode)
    .eq("entity_number", entityNumber)
    .eq("source", recordSource(stateCode, entityNumber).name)
    .maybeSingle();
  if (!data?.raw) return null;
  return { id: data.id as string, retrievedAt: data.retrieved_at as string, sourceUrl: (data.source_url as string) ?? PA_OPEN_DATA.datasetUrl, detail: data.raw as RegistryDetail };
}

/**
 * Re-read the register record the visitor picked and keep it server-side for prefill, linked
 * to their business. Best effort: if the register is unavailable now, the customer types it.
 */
export async function linkRegistryRecord(userId: string, businessId: string, stateCode: string, entityNumber: string): Promise<StoredStateRecord | null> {
  try {
    const detail = await getStateRecord(stateCode, entityNumber);
    if (!detail) return null;
    const stored = await saveStateRecord(stateCode, detail);
    await createAdminClient()
      .from("businesses")
      .update({
        state_entity_number: detail.entityNumber,
        registry_record: { source: "state_registry", state_entity_record_id: stored.id, source_url: stored.sourceUrl, retrieved_at: stored.retrievedAt },
      })
      .eq("id", businessId)
      .eq("owner_user_id", userId);
    return stored;
  } catch {
    // Prefill is a convenience; never block an order on it.
    return null;
  }
}
