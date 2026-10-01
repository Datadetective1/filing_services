import { describe, expect, it } from "vitest";
import { buildPrefill, sameValue, type PrefillInputs } from "@/lib/intake/prefill";
import type { RegistryDetail } from "@/lib/registry/pa-open-data-map";

const detail: RegistryDetail = {
  entityNumber: "0007380992",
  name: "Daff Trucking LLC",
  typeRaw: "Domestic Limited Liability Company",
  entityType: "llc",
  isForeign: false,
  isNonprofit: false,
  city: "Macungie",
  region: "PA",
  county: "Lehigh",
  formationDate: "2021-10-12",
  jurisdictionOfFormation: "Pennsylvania",
  addressOnRecord: { line1: "85 Willow St", line2: "", city: "Macungie", region: "PA", postal_code: "18062", county: "Lehigh" },
  governors: [{ name: "ALIOU DAFF", title: "Governor" }],
  officers: [{ name: "ALIOU DAFF", title: "President" }],
};

const registry = { id: "rec-1", retrievedAt: "2026-09-30T22:00:00.000Z", sourceUrl: "https://data.pa.gov/x", detail };

function input(over: Partial<PrefillInputs> = {}): PrefillInputs {
  return {
    business: { legalName: "Daff Trucking LLC", entityNumber: "0007380992", isForeign: false, homeJurisdiction: null, stateName: "Pennsylvania" },
    profile: {},
    registry,
    previous: null,
    now: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

describe("buildPrefill", () => {
  it("fills identity, registered office, governors and officers from the register with provenance", () => {
    const { answers, provenance } = buildPrefill(input());
    expect(answers).toEqual({
      legal_name: "Daff Trucking LLC",
      entity_number: "0007380992",
      jurisdiction_of_formation: "Pennsylvania",
      registered_office: { mode: "address", line1: "85 Willow St", line2: "", city: "Macungie", region: "PA", postal_code: "18062", county: "Lehigh" },
      governors: [{ name: "ALIOU DAFF", title: "Governor" }],
      principal_officers: [{ name: "ALIOU DAFF", title: "President" }],
    });
    expect(provenance.map((p) => [p.field_key, p.source])).toEqual([
      ["legal_name", "state_registry"],
      ["entity_number", "state_registry"],
      ["jurisdiction_of_formation", "state_registry"],
      ["registered_office", "state_registry"],
      ["governors", "state_registry"],
      ["principal_officers", "state_registry"],
    ]);
    for (const p of provenance) {
      expect(p).toMatchObject({ source_url: "https://data.pa.gov/x", state_entity_record_id: "rec-1", retrieved_at: "2026-09-30T22:00:00.000Z" });
      expect(p.original_value).toEqual(answers[p.field_key]);
    }
  });

  it("never fills the principal office from the register (it doesn't say which address it is)", () => {
    expect(buildPrefill(input()).answers.principal_office).toBeUndefined();
  });

  it("does not use an out-of-state register address as the registered office", () => {
    const out = { ...registry, detail: { ...detail, addressOnRecord: { ...detail.addressOnRecord!, region: "NJ" } } };
    expect(buildPrefill(input({ registry: out })).answers.registered_office).toBeUndefined();
  });

  it("attributes the name to the register only while it still matches the register exactly", () => {
    const { provenance } = buildPrefill(input({ business: { ...input().business, legalName: "DAFF TRUCKING, LLC" } }));
    expect(provenance.find((p) => p.field_key === "legal_name")).toBeUndefined();
  });

  it("prefers the customer's previous filing, then their saved profile, over the register", () => {
    const previous = {
      at: "2025-06-01T00:00:00.000Z",
      answers: { governors: [{ name: "Aliou Daff", title: "Managing Member" }], principal_office: { line1: "1 Main St", city: "Allentown", region: "PA", postal_code: "18101" } },
    };
    const profile = { registeredOffice: { mode: "crop", crop_name: "Registered Agents Inc", county: "Lehigh" } };
    const { answers, provenance } = buildPrefill(input({ previous, profile }));
    expect(answers.governors).toEqual(previous.answers.governors);
    expect(answers.principal_office).toEqual(previous.answers.principal_office);
    expect(answers.registered_office).toEqual(profile.registeredOffice);
    const src = Object.fromEntries(provenance.map((p) => [p.field_key, p.source]));
    expect(src).toMatchObject({ governors: "previous_filing", principal_office: "previous_filing", registered_office: "business_profile", principal_officers: "state_registry" });
    expect(provenance.find((p) => p.field_key === "governors")!.retrieved_at).toBe("2025-06-01T00:00:00.000Z");
  });

  it("works without a register record (manual lookup): nothing is attributed to the state", () => {
    const { answers, provenance } = buildPrefill(input({ registry: null }));
    expect(answers).toEqual({ legal_name: "Daff Trucking LLC", entity_number: "0007380992", jurisdiction_of_formation: "Pennsylvania" });
    expect(provenance).toEqual([]);
  });

  it("leaves a foreign entity's jurisdiction to the customer when the register can't say", () => {
    const foreign = { ...registry, detail: { ...detail, isForeign: true, jurisdictionOfFormation: null } };
    const { answers } = buildPrefill(input({ registry: foreign, business: { ...input().business, isForeign: true, homeJurisdiction: null } }));
    expect(answers.jurisdiction_of_formation).toBeUndefined();
  });
});

describe("sameValue", () => {
  it("ignores whitespace, key order and empty optional parts, but sees real edits", () => {
    expect(sameValue({ line1: "85 Willow St", line2: "", city: "Macungie" }, { city: "Macungie ", line1: "85  Willow St" })).toBe(true);
    expect(sameValue([{ name: "A", title: "Governor" }], [{ name: "A", title: "Manager" }])).toBe(false);
    expect(sameValue("Daff Trucking LLC", "DAFF TRUCKING LLC")).toBe(false);
  });
});
