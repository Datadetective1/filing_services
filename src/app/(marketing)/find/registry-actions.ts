"use server";

import { redirect } from "next/navigation";
import { trackServer } from "@/lib/analytics/server";
import { findRule } from "@/lib/compliance/registry";
import { formationDateRequired } from "@/lib/compliance/state-meta";
import { lookupSchema, setPendingLookup } from "@/lib/lookup/pending";
import type { RegistryHit } from "@/lib/registry/pa-open-data-map";
import { registrySource } from "@/lib/registry/sources";
import { getStateRecord, RegistryUnavailableError, searchStateRegister } from "@/lib/registry/state-open-data";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { readServiceIntent } from "@/lib/services/intent";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import { setLookupHomeJurisdiction } from "./lookup-extras";

export type RegistrySearchResult =
  | { status: "ok"; results: RegistryHit[] }
  | { status: "too_short" | "limited" | "unavailable"; results: [] };

/**
 * Search a state's business register (its official open dataset). Rate-limited per visitor
 * so the site never becomes a proxy for the dataset. Pennsylvania when no state is given.
 */
export async function searchRegistry(q: string, state: string = "PA"): Promise<RegistrySearchResult> {
  const query = String(q ?? "").slice(0, 100);
  const stateCode = registrySource(String(state ?? ""))?.code;
  if (!stateCode) return { status: "unavailable", results: [] };
  if (query.replace(/[^A-Za-z0-9]/g, "").length < 3) return { status: "too_short", results: [] };
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`registry-search:${ip}`, 30, 60))) return { status: "limited", results: [] };
  try {
    const results = await searchStateRegister(stateCode, query);
    await trackServer("registry_search", { stateCode, properties: { outcome: results.length ? "found" : "none", count: results.length } });
    return { status: "ok", results };
  } catch (e) {
    if (e instanceof RegistryUnavailableError) {
      await trackServer("registry_search", { stateCode, properties: { outcome: "unavailable" } });
      return { status: "unavailable", results: [] };
    }
    throw e;
  }
}

export interface RegistrySelectState {
  error?: string;
}

/**
 * The visitor picked a business from the register. Re-read it server-side (never trust
 * the browser's copy), then continue to the result page exactly like a typed lookup.
 */
export async function selectRegistryEntity(_prev: RegistrySelectState, formData: FormData): Promise<RegistrySelectState> {
  const source = registrySource(String(formData.get("stateCode") ?? "PA"));
  if (!source) return { error: "Choose your state, then search again." };
  const stateCode = source.code;
  const raw = String(formData.get("entityNumber") ?? "");
  const entityNumber = stateCode === "PA" ? raw.replace(/\D/g, "").slice(0, 10) : raw.replace(/[^A-Za-z0-9-]/g, "").slice(0, 20);
  if (!entityNumber) return { error: "Choose a business from the list." };
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`registry-select:${ip}`, 20, 60))) return { error: "Too many lookups in a short time. Wait a minute and try again." };

  let record;
  try {
    record = await getStateRecord(stateCode, entityNumber);
  } catch (e) {
    if (e instanceof RegistryUnavailableError) {
      return { error: `${source.name}'s business register isn't responding right now. Enter your details below instead.` };
    }
    throw e;
  }
  if (!record) return { error: "We couldn't load that record. Enter your details below instead." };
  if (stateCode === "PA") {
    if (!record.entityType || !findRule("PA", record.entityType, "annual_report", Boolean(record.isForeign))) {
      return {
        error: `We don't handle annual reports for "${record.typeRaw || "this registration type"}" yet. You can file directly at file.dos.pa.gov.`,
      };
    }
  } else if (!record.entityType) {
    return { error: `We can't use "${record.typeRaw || "this registration type"}" records yet. Enter your details below instead.` };
  }
  const forAgent = businessServicesPagesEnabled() && (await readServiceIntent()) === "registered_agent";
  if (!record.formationDate && formationDateRequired(stateCode) && !forAgent) {
    return { error: "That record doesn't show a formation date, which sets the due date. Enter your details below instead." };
  }

  const parsed = lookupSchema.safeParse({
    stateCode,
    entityType: record.entityType,
    legalName: record.name,
    formationDate: record.formationDate,
    entityNumber: record.entityNumber,
    isForeign: Boolean(record.isForeign),
    isNonprofit: record.isNonprofit,
    alreadyFiledThisYear: false,
    registryEntityNumber: record.entityNumber,
  });
  if (!parsed.success) return { error: "That record is missing details we need. Enter your details below instead." };

  await setPendingLookup(parsed.data);
  await setLookupHomeJurisdiction(record.isForeign ? record.jurisdictionOfFormation : null);
  await trackServer("registry_selected", {
    stateCode,
    entityType: record.entityType,
    properties: { governors: record.governors.length, officers: record.officers.length, address: Boolean(record.addressOnRecord) },
  });
  redirect("/find/result?from=registry");
}
