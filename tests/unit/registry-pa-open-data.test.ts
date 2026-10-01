import { describe, expect, it } from "vitest";
import {
  classifyParty,
  mapRegistrationType,
  normalizeSearchQuery,
  soqlPrefix,
  soqlString,
  tidyBusinessName,
  toDetail,
  toHit,
  type PaOpenDataRow,
} from "@/lib/registry/pa-open-data-map";

// Shape copied from the live dataset (data.pa.gov xvd7-5r2c), 2026-09-30.
const base: PaOpenDataRow = {
  business_name: "Daff Trucking Llc",
  filing_number: "0007380992",
  address_line1: "85 Willow St",
  city: "Macungie",
  state: "PA",
  zip: "18062",
  typeofbusinessregistration: "Domestic Limited Liability Company",
  creationdate: "2021-10-12T00:00:00.000",
  shortcountyname: "Lehigh",
};

describe("PA open data mapping", () => {
  it("maps registration types, including foreign and nonprofit, and leaves unsupported ones unknown", () => {
    expect(mapRegistrationType("Domestic Limited Liability Company")).toEqual({ entityType: "llc", isForeign: false, isNonprofit: false });
    expect(mapRegistrationType("Foreign Business Corporation")).toEqual({ entityType: "corporation", isForeign: true, isNonprofit: false });
    expect(mapRegistrationType("Domestic Nonprofit Corporation")).toEqual({ entityType: "nonprofit_corporation", isForeign: false, isNonprofit: true });
    expect(mapRegistrationType("Domestic Limited Partnership (LP/LLLP)").entityType).toBe("lp");
    expect(mapRegistrationType("Authority").entityType).toBeNull();
    expect(mapRegistrationType("Domestic General Partnership (GP/LLP)").entityType).toBeNull();
    expect(mapRegistrationType(undefined)).toEqual({ entityType: null, isForeign: null, isNonprofit: false });
  });

  it("classifies current governance and ignores organizers, incorporators, owners and blanks", () => {
    expect(classifyParty("Governor")).toBe("governor");
    expect(classifyParty("MANAGING MEMBER")).toBe("governor");
    expect(classifyParty("Director")).toBe("governor");
    expect(classifyParty("President")).toBe("officer");
    expect(classifyParty("Chief Financial Officer")).toBe("officer");
    for (const t of ["Organizer", "Incorporator", "Owner", "Other", "Partner", undefined, ""]) expect(classifyParty(t)).toBeNull();
  });

  it("restores suffix casing in title-cased names", () => {
    expect(tidyBusinessName("Daff Trucking Llc")).toBe("Daff Trucking LLC");
    expect(tidyBusinessName("  Acme   Holdings Lp ")).toBe("Acme Holdings LP");
  });

  it("collapses per-person rows into one record with governors, officers, address and county", () => {
    const d = toDetail([
      { ...base, party_type: "President", first_name: "ALIOU", last_name: "DAFF" },
      { ...base, party_type: "Governor", first_name: "ALIOU", last_name: "DAFF" },
      { ...base, party_type: "Governor", first_name: "ALIOU", last_name: "DAFF" },
      { ...base, party_type: "Organizer", first_name: "PAT", last_name: "FILER" },
    ])!;
    expect(d).toMatchObject({
      entityNumber: "0007380992",
      name: "Daff Trucking LLC",
      entityType: "llc",
      isForeign: false,
      formationDate: "2021-10-12",
      jurisdictionOfFormation: "Pennsylvania",
      addressOnRecord: { line1: "85 Willow St", line2: "", city: "Macungie", region: "PA", postal_code: "18062", county: "Lehigh" },
      governors: [{ name: "ALIOU DAFF", title: "Governor" }],
      officers: [{ name: "ALIOU DAFF", title: "President" }],
    });
  });

  it("does not claim a jurisdiction for a foreign entity (the dataset doesn't say where it was formed)", () => {
    expect(toDetail([{ ...base, typeofbusinessregistration: "Foreign Limited Liability Company" }])!.jurisdictionOfFormation).toBeNull();
  });

  it("returns null for rows without an entity number or name", () => {
    expect(toDetail([])).toBeNull();
    expect(toHit({ business_name: "X" })).toBeNull();
  });
});

describe("search query safety", () => {
  it("recognizes entity numbers and pads them like the dataset", () => {
    expect(normalizeSearchQuery("7380992")).toEqual({ kind: "number", value: "0007380992" });
    expect(normalizeSearchQuery("0007380992")).toEqual({ kind: "number", value: "0007380992" });
  });

  it("uppercases names, strips SoQL-significant characters and requires 3 letters or digits", () => {
    expect(normalizeSearchQuery("daff trucking")).toEqual({ kind: "name", value: "DAFF TRUCKING" });
    expect(normalizeSearchQuery("ab")).toBeNull();
    expect(normalizeSearchQuery("x');drop--")).toEqual({ kind: "name", value: "X');DROP--".replace(/[;)]/g, "") });
  });

  it("quotes literals so input can't break out of the string", () => {
    expect(soqlString("O'BRIEN")).toBe("'O''BRIEN'");
    expect(soqlPrefix("100%_ OFF")).toBe("'100 OFF%'");
  });
});
