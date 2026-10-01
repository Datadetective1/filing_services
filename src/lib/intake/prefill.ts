import type { RegistryDetail } from "@/lib/registry/pa-open-data-map";
import type { IntakeAnswers } from "./validate";

/**
 * Builds the initial intake answers for a new filing and records where each value came
 * from. Pure (no I/O) so it can be tested; the caller loads the inputs and stores the
 * provenance rows in filing_prefill.
 *
 * Source priority per field: the customer's previous filing for this business (what they
 * last filed), then their saved business profile, then the state's register. A value is
 * only ever a starting point: the customer reviews every field and signs before filing.
 */

export type PrefillSource = "state_registry" | "previous_filing" | "business_profile";

export interface PrefillProvenance {
  field_key: string;
  source: PrefillSource;
  source_url: string | null;
  state_entity_record_id: string | null;
  retrieved_at: string;
  original_value: unknown;
}

export interface PrefillInputs {
  business: {
    legalName: string;
    entityNumber: string | null;
    isForeign: boolean;
    homeJurisdiction: string | null;
    stateName: string;
  };
  profile: {
    principalOffice?: Record<string, string> | null;
    registeredOffice?: Record<string, string> | null;
    governors?: { name: string; title: string }[];
    officers?: { name: string; title: string }[];
  };
  registry: { id: string; retrievedAt: string; sourceUrl: string; detail: RegistryDetail } | null;
  previous: { answers: IntakeAnswers; at: string } | null;
  now: string;
}

const CARRY_FORWARD = ["registered_office", "principal_office", "governors", "principal_officers", "jurisdiction_of_formation", "state_notice_email"] as const;

function present(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(present);
  return true;
}

export function buildPrefill(input: PrefillInputs): { answers: IntakeAnswers; provenance: PrefillProvenance[] } {
  const { business, profile, registry, previous, now } = input;
  const answers: IntakeAnswers = {};
  const provenance: PrefillProvenance[] = [];
  const reg = registry?.detail ?? null;

  const set = (key: string, value: unknown, source: PrefillSource | null) => {
    if (!present(value)) return false;
    answers[key] = value;
    if (source) {
      provenance.push({
        field_key: key,
        source,
        source_url: source === "state_registry" ? (registry?.sourceUrl ?? null) : null,
        state_entity_record_id: source === "state_registry" ? (registry?.id ?? null) : null,
        retrieved_at: source === "state_registry" ? (registry?.retrievedAt ?? now) : source === "previous_filing" ? (previous?.at ?? now) : now,
        original_value: value,
      });
    }
    return true;
  };

  // Identity: from the business row (confirmed by the customer at lookup). Attributed to the
  // register only when it still matches the register exactly.
  set("legal_name", business.legalName, reg && reg.name === business.legalName ? "state_registry" : null);
  set("entity_number", business.entityNumber ?? "", reg && reg.entityNumber === business.entityNumber ? "state_registry" : null);

  // Carry forward last year's answers first.
  const prev = previous?.answers ?? {};
  const filled = new Set<string>();
  for (const key of CARRY_FORWARD) if (set(key, prev[key], "previous_filing")) filled.add(key);

  if (!filled.has("jurisdiction_of_formation")) {
    if (business.isForeign) set("jurisdiction_of_formation", business.homeJurisdiction ?? "", null);
    else set("jurisdiction_of_formation", business.stateName, reg?.jurisdictionOfFormation ? "state_registry" : null);
  }

  if (!filled.has("principal_office") && profile.principalOffice) set("principal_office", profile.principalOffice, "business_profile");

  if (!filled.has("registered_office")) {
    if (profile.registeredOffice) set("registered_office", profile.registeredOffice, "business_profile");
    // The register's single street address is used only when it is in Pennsylvania (a
    // registered office must be); the customer confirms it or switches to a CROP.
    else if (reg?.addressOnRecord && reg.addressOnRecord.region === "PA") {
      const a = reg.addressOnRecord;
      set("registered_office", { mode: "address", line1: a.line1, line2: a.line2, city: a.city, region: a.region, postal_code: a.postal_code, county: a.county }, "state_registry");
    }
  }

  if (!filled.has("governors")) {
    if (profile.governors?.length) set("governors", profile.governors, "business_profile");
    else if (reg?.governors.length) set("governors", reg.governors, "state_registry");
  }
  if (!filled.has("principal_officers")) {
    if (profile.officers?.length) set("principal_officers", profile.officers, "business_profile");
    else if (reg?.officers.length) set("principal_officers", reg.officers, "state_registry");
  }

  return { answers, provenance };
}

/** Stable comparison of a prefilled value with what the customer finally signed. */
export function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => present(x))
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([k, x]) => [k, norm(x)]),
      );
    }
    return v ?? null;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
