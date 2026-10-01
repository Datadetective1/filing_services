import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PA_OPEN_DATA, type RegistryDetail } from "./pa-open-data-map";

/**
 * state_entity_records is written ONLY here, by the server, from data it fetched itself.
 * It is service-role only, so a "came from the state's register" claim can never rest on
 * anything a customer could edit (unlike businesses.registry_record).
 */

export interface StoredStateRecord {
  id: string;
  retrievedAt: string;
  sourceUrl: string;
  detail: RegistryDetail;
}

export async function saveStateRecord(stateCode: string, detail: RegistryDetail): Promise<StoredStateRecord> {
  const retrievedAt = new Date().toISOString();
  const sourceUrl = `${PA_OPEN_DATA.datasetUrl}?filing_number=${encodeURIComponent(detail.entityNumber)}`;
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
        registered_office: detail.addressOnRecord,
        governors: detail.governors,
        officers: detail.officers,
        annual_reports: null, // the open dataset does not publish filing history
        source: PA_OPEN_DATA.sourceName,
        source_url: sourceUrl,
        source_licence: PA_OPEN_DATA.licence,
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
    .eq("source", PA_OPEN_DATA.sourceName)
    .maybeSingle();
  if (!data?.raw) return null;
  return { id: data.id as string, retrievedAt: data.retrieved_at as string, sourceUrl: (data.source_url as string) ?? PA_OPEN_DATA.datasetUrl, detail: data.raw as RegistryDetail };
}
