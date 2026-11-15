import { describe, expect, it } from "vitest";
import { buildPrefill, type PrefillInputs } from "@/lib/intake/prefill";
import type { RegistryDetail } from "@/lib/registry/pa-open-data-map";
import { addressLine, connecticutPrincipals, regionCode, STATE_DATASETS, toStateDetail, usAddress } from "@/lib/registry/state-open-data-map";
import { recordSource } from "@/lib/registry/state-records";

// Row shapes as read from each state's dataset on 2026-11-15; names and addresses are made up.

describe("labeled addresses on a state record", () => {
  it("reads Colorado's principal, mailing and agent addresses (data.colorado.gov 4ykn-tg5h)", () => {
    const d = toStateDetail(STATE_DATASETS.CO, [
      {
        entityid: "19931114689",
        entityname: "Example Hills, LLC",
        entitytype: "DLLC",
        entityformdate: "1993-10-14T00:00:00.000",
        jurisdictonofformation: "CO",
        principaladdress1: "100 Example Dr",
        principalcity: "Boulder",
        principalstate: "CO",
        principalzipcode: "80303",
        principalcountry: "US",
        mailingaddress1: "PO Box 12",
        mailingcity: "Boulder",
        mailingstate: "CO",
        mailingzipcode: "80306",
        mailingcountry: "US",
        agentfirstname: "JANE",
        agentmiddlename: "Q",
        agentlastname: "SAMPLE",
        agentprincipaladdress1: "100 Example Dr",
        agentprincipalcity: "Boulder",
        agentprincipalstate: "CO",
        agentprincipalzipcode: "80303",
        agentprincipalcountry: "US",
      },
    ])!;
    expect(d.principalAddress).toEqual({ line1: "100 Example Dr", line2: "", city: "Boulder", region: "CO", postal_code: "80303", county: "" });
    expect(d.mailingAddress?.line1).toBe("PO Box 12");
    expect(d.agent).toEqual({ name: "JANE Q SAMPLE", address: { line1: "100 Example Dr", line2: "", city: "Boulder", region: "CO", postal_code: "80303", county: "" } });
  });

  it("prefers a Colorado agent organization's name over a person's", () => {
    const d = toStateDetail(STATE_DATASETS.CO, [
      { entityid: "19931136554", entityname: "Example Properties, LLC", entitytype: "DLLC", agentorganizationname: "Example Agents Inc." },
    ])!;
    expect(d.agent).toEqual({ name: "Example Agents Inc.", address: null });
    expect(d.principalAddress).toBeNull();
  });

  it("reads New York's location, agent and chairman, cleaning trailing commas and full state names", () => {
    const d = toStateDetail(STATE_DATASETS.NY, [
      {
        dos_id: "8132154",
        current_entity_name: "EXAMPLE ISLAND LLC",
        entity_type: "DOMESTIC LIMITED LIABILITY COMPANY",
        jurisdiction: "New York",
        location_address_1: "606 Example Rd,",
        location_city: "Manorville",
        location_state: "NY",
        location_zip: "11949",
        registered_agent_name: "Example Agent Co., Inc.",
        registered_agent_address_1: "45 Main Street",
        registered_agent_address_2: "Suite 238",
        registered_agent_city: "Brooklyn",
        registered_agent_state: "NEW YORK",
        registered_agent_zip: "11201",
        chairman_name: "PAT EXAMPLE",
      },
    ])!;
    expect(d.principalAddress?.line1).toBe("606 Example Rd");
    expect(d.agent?.address).toMatchObject({ line2: "Suite 238", region: "NY" });
    expect(d.governors).toEqual([{ name: "PAT EXAMPLE", title: "Chairman of the board" }]);
  });

  it("reads Oregon's labeled rows: place of business, mailing address and agent", () => {
    const base = { registry_number: "104466990", business_name: "EXAMPLE CENTER, LLC", entity_type: "DOMESTIC LIMITED LIABILITY COMPANY", jurisdiction: "OR" };
    const d = toStateDetail(STATE_DATASETS.OR, [
      { ...base, associated_name_type: "MAILING ADDRESS", address: "3333 NE EXAMPLE BLVD STE 207", city: "PORTLAND", state: "OR", zip: "97232" },
      { ...base, associated_name_type: "REGISTERED AGENT", entity_of_record_name: "EXAMPLE AGENTS INC", address: "5441 S EXAMPLE AVE", city: "PORTLAND", state: "OR", zip: "97239" },
      { ...base, associated_name_type: "PRINCIPAL PLACE OF BUSINESS", address: "3333 NE EXAMPLE BLVD #207", city: "PORTLAND", state: "OR", zip: "97232" },
    ])!;
    expect(d.principalAddress?.line1).toBe("3333 NE EXAMPLE BLVD #207");
    expect(d.mailingAddress?.line1).toBe("3333 NE EXAMPLE BLVD STE 207");
    expect(d.agent?.name).toBe("EXAMPLE AGENTS INC");
    expect(d.governors).toEqual([]);
  });

  it("reads Connecticut's business address and leaves its placeholders out", () => {
    const row = { accountnumber: "0975250", name: "Example Works LLC", business_type: "LLC", citizenship: "Domestic", billingcity: "Hartford", billingstate: "CT", billingpostalcode: "06103" };
    expect(toStateDetail(STATE_DATASETS.CT, [{ ...row, billingstreet: "1 Example Plaza", billing_unit: "Suite 4" }])!.principalAddress).toMatchObject({ line1: "1 Example Plaza", line2: "Suite 4" });
    expect(toStateDetail(STATE_DATASETS.CT, [{ ...row, billingstreet: "No information provided" }])!.principalAddress).toBeNull();
  });

  it("gives Texas only the Comptroller's mailing address", () => {
    const d = toStateDetail(STATE_DATASETS.TX, [
      { secretary_of_state_sos_or_coa_file_number: "0806762076", taxpayer_name: "EXAMPLE REALTY LLC", taxpayer_organizational_type: "CL", taxpayer_address: "1 EXAMPLE ST", taxpayer_city: "HOUSTON", taxpayer_state: "TX", taxpayer_zip: "770021234" },
    ])!;
    expect(d.mailingAddress).toMatchObject({ line1: "1 EXAMPLE ST", postal_code: "77002-1234" });
    expect(d.principalAddress).toBeNull();
    expect(d.agent).toBeNull();
  });

  it("never completes an address it can't use", () => {
    expect(usAddress({ line1: "1 Main St", city: "Toronto", region: "ON", zip: "M5V 1A1", country: "CANADA" })).toBeNull();
    expect(usAddress({ line1: "1 Main St", city: "Denver", region: "CO" })).toBeNull();
    expect(usAddress({ line1: "NONE", city: "Denver", region: "CO", zip: "80202" })).toBeNull();
    expect(regionCode("new york")).toBe("NY");
    expect(regionCode("Ontario")).toBe("");
    expect(addressLine({ line1: "1 Main St", line2: "", city: "Denver", region: "CO", postal_code: "80202", county: "" })).toBe("1 Main St, Denver, CO 80202");
  });
});

describe("Connecticut principals", () => {
  const rows = [
    { name__c: "ALEX EXAMPLE", designation: "Officer;Director", business_street_address_1: "1 Example Plaza", business_city: "Hartford", business_state: "CT", business_zip_code: "06103" },
    { name__c: "SAM EXAMPLE", designation: "Director" },
    { name__c: "SAM EXAMPLE", designation: "Director" },
    { name__c: "John Doe" },
  ];
  it("sorts a corporation's officers and directors, with business addresses only", () => {
    expect(connecticutPrincipals(rows, "corporation")).toEqual({
      officers: [{ name: "ALEX EXAMPLE", title: "Officer and director", address: "1 Example Plaza, Hartford, CT 06103" }],
      governors: [{ name: "SAM EXAMPLE", title: "Director" }],
    });
  });
  it("lists an LLC's principals as members or managers", () => {
    expect(connecticutPrincipals(rows, "llc").governors.map((p) => p.title)).toEqual(["Member or manager", "Member or manager"]);
  });
});

describe("where a saved record came from", () => {
  it("keeps Pennsylvania's source and names each open-data state's own", () => {
    expect(recordSource("PA", "0007380992").name).toBe("pa_dos_open_data");
    expect(recordSource("CO", "19931114689")).toMatchObject({ name: "co_open_data", url: "https://data.colorado.gov/resource/4ykn-tg5h.json?entityid=19931114689" });
    expect(recordSource("NY", "8132154").name).toBe("ny_open_data");
  });
});

describe("Colorado details step prefill", () => {
  const address = (line1: string, region = "CO") => ({ line1, line2: "", city: "Denver", region, postal_code: "80202", county: "" });
  const detail: RegistryDetail = {
    entityNumber: "20131234567",
    name: "Example Hills, LLC",
    typeRaw: "Domestic limited liability company",
    entityType: "llc",
    isForeign: false,
    isNonprofit: false,
    city: "Denver",
    region: "CO",
    county: "",
    formationDate: "2013-01-01",
    jurisdictionOfFormation: "Colorado",
    addressOnRecord: null,
    governors: [],
    officers: [],
    principalAddress: address("100 Example Dr"),
    mailingAddress: address("PO Box 12"),
    agent: { name: "Example Agents Inc.", address: address("200 Agent St") },
  };
  const input = (d: RegistryDetail, over: Partial<PrefillInputs> = {}): PrefillInputs => ({
    business: { legalName: "Example Hills, LLC", entityNumber: "20131234567", isForeign: false, homeJurisdiction: null, stateName: "Colorado", stateCode: "CO" },
    profile: {},
    registry: { id: "rec-co", retrievedAt: "2026-11-15T00:00:00.000Z", sourceUrl: "https://data.colorado.gov/x", detail: d },
    previous: null,
    now: "2026-11-15T00:00:00.000Z",
    ...over,
  });
  const street = (line1: string) => ({ line1, line2: "", city: "Denver", region: "CO", postal_code: "80202" });

  it("fills the principal office, mailing address and registered agent, each tagged to the register", () => {
    const { answers, provenance } = buildPrefill(input(detail));
    expect(answers).toMatchObject({
      principal_office: street("100 Example Dr"),
      mailing_address: street("PO Box 12"),
      registered_agent_name: "Example Agents Inc.",
      registered_office: street("200 Agent St"),
    });
    expect(answers.registered_agent_change).toBeUndefined();
    const fromRegister = provenance.filter((p) => p.source === "state_registry").map((p) => p.field_key);
    expect(fromRegister).toEqual(expect.arrayContaining(["principal_office", "mailing_address", "registered_agent_name", "registered_office"]));
  });

  it("leaves out a P.O. box as the street address and an agent outside the state", () => {
    const { answers } = buildPrefill(input({ ...detail, principalAddress: address("P.O. Box 9"), agent: { name: "Far Agent", address: address("1 Far Rd", "WY") } }));
    expect(answers.principal_office).toBeUndefined();
    expect(answers.registered_agent_name).toBeUndefined();
    expect(answers.registered_office).toBeUndefined();
  });

  it("keeps the customer's saved details and last filing ahead of the register", () => {
    const { answers, provenance } = buildPrefill(
      input(detail, {
        profile: { principalOffice: street("9 Saved Ave") },
        previous: { answers: { registered_agent_name: "Last Year Agent", registered_office: street("8 Old St") }, at: "2025-11-01T00:00:00.000Z" },
      }),
    );
    expect(answers.principal_office).toEqual(street("9 Saved Ave"));
    expect(answers.registered_agent_name).toBe("Last Year Agent");
    expect(provenance.find((p) => p.field_key === "registered_office")?.source).toBe("previous_filing");
  });
});
