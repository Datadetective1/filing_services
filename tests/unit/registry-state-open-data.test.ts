import { describe, expect, it } from "vitest";
import { hasRegistrySearch, registrySource, registryStates } from "@/lib/registry/sources";
import {
  isoDate,
  mapColoradoType,
  mapConnecticutType,
  mapLongType,
  mapTexasType,
  parseStateQuery,
  STATE_DATASETS,
  stripColoradoNameSuffix,
  toStateDetail,
  uniqueHits,
} from "@/lib/registry/state-open-data-map";

describe("register sources", () => {
  it("lists every state with a dataset, plus Pennsylvania", () => {
    expect(registryStates().map((s) => s.code)).toEqual(["CO", "CT", "NY", "OR", "PA", "TX"]);
    for (const code of Object.keys(STATE_DATASETS)) expect(hasRegistrySearch(code)).toBe(true);
    expect(hasRegistrySearch("FL")).toBe(false);
    expect(hasRegistrySearch("")).toBe(false);
    expect(registrySource("ny")?.name).toBe("New York");
  });
});

describe("type mapping", () => {
  it("reads long type names (New York, Oregon)", () => {
    expect(mapLongType("DOMESTIC LIMITED LIABILITY COMPANY")).toEqual({ entityType: "llc", isForeign: false, isNonprofit: false });
    expect(mapLongType("FOREIGN BUSINESS CORPORATION")).toEqual({ entityType: "corporation", isForeign: true, isNonprofit: false });
    expect(mapLongType("DOMESTIC NOT-FOR-PROFIT CORPORATION")).toEqual({ entityType: "nonprofit_corporation", isForeign: false, isNonprofit: true });
    expect(mapLongType("DOMESTIC NONPROFIT CORPORATION").entityType).toBe("nonprofit_corporation");
    expect(mapLongType("DOMESTIC REGISTERED LIMITED LIABILITY PARTNERSHIP").entityType).toBe("llp");
    expect(mapLongType("NEW YORK REGISTERED FOREIGN LIMITED LIABILITY PARTNERSHIP")).toEqual({ entityType: "llp", isForeign: true, isNonprofit: false });
    expect(mapLongType("DOMESTIC LIMITED PARTNERSHIP").entityType).toBe("lp");
    expect(mapLongType("DOMESTIC PROFESSIONAL CORPORATION").entityType).toBe("corporation");
    expect(mapLongType("DOMESTIC BUSINESS TRUST").entityType).toBe("business_trust");
    expect(mapLongType("DOMESTIC PROFESSIONAL SERVICE CORPORATION/LIMITED LIABILITY COMPANY").entityType).toBeNull();
    expect(mapLongType("COOPERATIVE").entityType).toBeNull();
    expect(mapLongType("ASSUMED BUSINESS NAME").entityType).toBeNull();
    expect(mapLongType(undefined).entityType).toBeNull();
  });

  it("reads Colorado, Connecticut and Texas codes", () => {
    expect(mapColoradoType("DLLC")).toEqual({ entityType: "llc", isForeign: false, isNonprofit: false });
    expect(mapColoradoType("FPC")).toEqual({ entityType: "corporation", isForeign: true, isNonprofit: false });
    expect(mapColoradoType("DNC").isNonprofit).toBe(true);
    expect(mapColoradoType("DLLLP").entityType).toBe("lp");
    expect(mapColoradoType("GP").entityType).toBeNull();

    expect(mapConnecticutType("LLC", "Domestic")).toEqual({ entityType: "llc", isForeign: false, isNonprofit: false });
    expect(mapConnecticutType("Stock", "Foreign")).toEqual({ entityType: "corporation", isForeign: true, isNonprofit: false });
    expect(mapConnecticutType("Non-Stock", "Domestic").isNonprofit).toBe(true);
    expect(mapConnecticutType("Religious", "Domestic").entityType).toBeNull();

    expect(mapTexasType("CL")).toEqual({ entityType: "llc", isForeign: false, isNonprofit: false });
    expect(mapTexasType("CI")).toEqual({ entityType: "llc", isForeign: true, isNonprofit: false });
    expect(mapTexasType("CN").isNonprofit).toBe(true);
    expect(mapTexasType("ES").entityType).toBeNull();
  });
});

describe("rows to hits and records", () => {
  it("drops Colorado's appended name events and placeholder dates", () => {
    expect(stripColoradoNameSuffix("Acme Widgets LLC, Delinquent December 1, 2013")).toBe("Acme Widgets LLC");
    expect(stripColoradoNameSuffix("Acme Widgets LLC")).toBe("Acme Widgets LLC");
    expect(isoDate("0001-01-01")).toBeNull();
    expect(isoDate("2013-06-27T00:00:00.000")).toBe("2013-06-27");
  });

  it("maps a New York row (shape from data.ny.gov n9v6-gdp6)", () => {
    const ny = STATE_DATASETS.NY;
    const rows = [
      {
        dos_id: "4424185",
        current_entity_name: "EXAMPLE WINE & SPIRITS, INC.",
        initial_dos_filing_date: "2013-06-27T00:00:00.000",
        county: "Westchester",
        jurisdiction: "New York",
        entity_type: "DOMESTIC BUSINESS CORPORATION",
      },
    ];
    const d = toStateDetail(ny, rows)!;
    expect(d).toMatchObject({
      entityNumber: "4424185",
      name: "EXAMPLE WINE & SPIRITS, INC.",
      entityType: "corporation",
      isForeign: false,
      formationDate: "2013-06-27",
      jurisdictionOfFormation: "New York",
      county: "Westchester",
    });
  });

  it("maps a Texas row and pads the SOS file number", () => {
    const tx = STATE_DATASETS.TX;
    expect(parseStateQuery(tx, "806762076")).toEqual({ kind: "number", value: "0806762076" });
    const d = toStateDetail(tx, [
      {
        secretary_of_state_sos_or_coa_file_number: "0806762076",
        taxpayer_name: "EXAMPLE REALTY TEXAS LLC",
        taxpayer_organizational_type: "CI",
        sos_charter_date: "2026-08-21T00:00:00.000",
        taxpayer_city: "HOUSTON",
        taxpayer_state: "TX",
      },
    ])!;
    expect(d).toMatchObject({ entityType: "llc", isForeign: true, typeRaw: "Non-Texas limited liability company", jurisdictionOfFormation: null });
  });

  it("collapses Oregon's rows per entity and keeps the place of business", () => {
    const or = STATE_DATASETS.OR;
    const base = { registry_number: "299818", business_name: "EXAMPLE CHURCH", entity_type: "DOMESTIC NONPROFIT CORPORATION", registry_date: "1850-05-17T00:00:00.000", jurisdiction: "OR" };
    const hits = uniqueHits(or, [
      { ...base, associated_name_type: "MAILING ADDRESS", city: "PO TOWN", state: "OR" },
      { ...base, associated_name_type: "PRINCIPAL PLACE OF BUSINESS", city: "OREGON CITY", state: "OR" },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ city: "OREGON CITY", entityType: "nonprofit_corporation", isNonprofit: true });
    expect(toStateDetail(or, [{ ...base, associated_name_type: "PRINCIPAL PLACE OF BUSINESS", city: "OREGON CITY", state: "OR" }])?.jurisdictionOfFormation).toBe("Oregon");
  });

  it("parses queries per state and rejects too-short text", () => {
    expect(parseStateQuery(STATE_DATASETS.CO, "20131234567")).toEqual({ kind: "number", value: "20131234567" });
    expect(parseStateQuery(STATE_DATASETS.NY, "0004072354")).toEqual({ kind: "number", value: "4072354" });
    expect(parseStateQuery(STATE_DATASETS.CT, "975250")).toEqual({ kind: "number", value: "0975250" });
    expect(parseStateQuery(STATE_DATASETS.CT, "acme widgets")).toEqual({ kind: "name", value: "ACME WIDGETS" });
    expect(parseStateQuery(STATE_DATASETS.CT, "ab")).toBeNull();
  });
});
