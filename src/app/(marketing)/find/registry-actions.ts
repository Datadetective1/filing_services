"use server";

import { redirect } from "next/navigation";
import { trackServer } from "@/lib/analytics/server";
import { findRule } from "@/lib/compliance/registry";
import { lookupSchema, setPendingLookup } from "@/lib/lookup/pending";
import type { RegistryHit } from "@/lib/registry/pa-open-data-map";
import { getPaRecord, RegistryUnavailableError, searchPaRegister } from "@/lib/registry/pa-open-data";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import { setLookupHomeJurisdiction } from "./lookup-extras";

export type RegistrySearchResult =
  | { status: "ok"; results: RegistryHit[] }
  | { status: "too_short" | "limited" | "unavailable"; results: [] };

/**
 * Search Pennsylvania's business register (the Department of State's official open
 * dataset). Rate-limited per visitor so the site never becomes a proxy for the dataset.
 */
export async function searchRegistry(q: string): Promise<RegistrySearchResult> {
  const query = String(q ?? "").slice(0, 100);
  if (query.replace(/[^A-Za-z0-9]/g, "").length < 3) return { status: "too_short", results: [] };
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`registry-search:${ip}`, 30, 60))) return { status: "limited", results: [] };
  try {
    const results = await searchPaRegister(query);
    await trackServer("registry_search", { stateCode: "PA", properties: { outcome: results.length ? "found" : "none", count: results.length } });
    return { status: "ok", results };
  } catch (e) {
    if (e instanceof RegistryUnavailableError) {
      await trackServer("registry_search", { stateCode: "PA", properties: { outcome: "unavailable" } });
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
  const entityNumber = String(formData.get("entityNumber") ?? "").replace(/\D/g, "").slice(0, 10);
  if (!entityNumber) return { error: "Choose a business from the list." };
  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`registry-select:${ip}`, 20, 60))) return { error: "Too many lookups in a short time. Wait a minute and try again." };

  let record;
  try {
    record = await getPaRecord(entityNumber);
  } catch (e) {
    if (e instanceof RegistryUnavailableError) {
      return { error: "Pennsylvania's business register isn't responding right now. Enter your details below instead." };
    }
    throw e;
  }
  if (!record) return { error: "We couldn't load that record. Enter your details below instead." };
  if (!record.entityType || !findRule("PA", record.entityType, "annual_report", Boolean(record.isForeign))) {
    return {
      error: `We don't handle annual reports for "${record.typeRaw || "this registration type"}" yet. You can file directly at file.dos.pa.gov.`,
    };
  }

  const parsed = lookupSchema.safeParse({
    stateCode: "PA",
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
  await setLookupHomeJurisdiction(null);
  await trackServer("registry_selected", {
    stateCode: "PA",
    entityType: record.entityType,
    properties: { governors: record.governors.length, officers: record.officers.length, address: Boolean(record.addressOnRecord) },
  });
  redirect("/find/result?from=registry");
}
