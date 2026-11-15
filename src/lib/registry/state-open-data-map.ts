import type { EntityType } from "@/lib/domain/types";
import type { RegistryAddress, RegistryDetail, RegistryHit, RegistryPerson } from "./pa-open-data-map";

/**
 * Pure mapping for the other states' official open business datasets (Socrata, queried
 * live, nothing stored). Pennsylvania keeps its own module (pa-open-data-map.ts) because
 * its dataset carries people and addresses that feed intake prefill.
 *
 * Every dataset below was read on 2026-11-01. Fields we never request: email, phone.
 * Search takes only what the lookup needs: name, number, type, formation date, place.
 * Reading one picked record also takes what the state labels as the business's addresses,
 * its registered agent and its principals (detailSelect, re-checked 2026-11-15), so the
 * order can start filled in. A residence address is never requested.
 */

export type Row = Record<string, string | undefined>;

type Mapped = { entityType: EntityType | null; isForeign: boolean | null; isNonprofit: boolean };

export interface StateDataset {
  code: string;
  host: string;
  dataset: string;
  numberField: string;
  nameField: string;
  /** Names are stored in upper case, so a plain LIKE can use the dataset's index. */
  upperCaseNames: boolean;
  /** Only the fields we need. */
  select: string[];
  /** Extra fields read for one picked record only (addresses, agent, principals). */
  detailSelect?: string[];
  /** What the state labels on one record: principal and mailing address, agent, principals. */
  details?(row: Row, all: Row[]): RecordDetails;
  /** Keeps current registrations only (and drops rows that aren't an entity). */
  where?: string;
  /** Typed digits to the dataset's stored number, or null when it can't be one. */
  number(digits: string): string | null;
  map(row: Row): Mapped;
  toHit(row: Row): RegistryHit | null;
  formationDate(row: Row): string | null;
  jurisdiction(row: Row): string | null;
}

export type RecordDetails = Pick<RegistryDetail, "principalAddress" | "mailingAddress" | "agent"> & {
  governors?: RegistryPerson[];
  officers?: RegistryPerson[];
};

const NONE: Mapped = { entityType: null, isForeign: null, isNonprofit: false };

/** "DOMESTIC LIMITED LIABILITY COMPANY", "FOREIGN NOT-FOR-PROFIT CORPORATION" and similar. */
export function mapLongType(raw: string | undefined): Mapped {
  const t = (raw ?? "").toUpperCase().replace(/\s+/g, " ").trim();
  if (!t) return NONE;
  const isForeign = /\bFOREIGN\b/.test(t) ? true : /^DOMESTIC\b/.test(t) ? false : null;
  if (/NOT-FOR-PROFIT|NONPROFIT|NON-PROFIT/.test(t)) return { entityType: "nonprofit_corporation", isForeign, isNonprofit: true };
  if (/COOPERATIVE|RELIGIOUS|INSURANCE|BANK|CEMETERY|EDUCATION|ASSUMED BUSINESS NAME|RESERVATION/.test(t)) return NONE;
  if (/LIMITED LIABILITY PARTNERSHIP/.test(t)) return { entityType: "llp", isForeign, isNonprofit: false };
  if (/LIMITED PARTNERSHIP/.test(t)) return { entityType: "lp", isForeign, isNonprofit: false };
  if (/LIMITED LIABILITY COMPANY/.test(t) && !/CORPORATION/.test(t)) return { entityType: "llc", isForeign, isNonprofit: false };
  if (/BUSINESS TRUST/.test(t)) return { entityType: "business_trust", isForeign, isNonprofit: false };
  if (/CORPORATION/.test(t) && !/LIMITED LIABILITY COMPANY/.test(t)) return { entityType: "corporation", isForeign, isNonprofit: false };
  return NONE;
}

const CO_TYPES: Record<string, EntityType> = { LLC: "llc", PC: "corporation", NC: "nonprofit_corporation", LP: "lp", LLLP: "lp", LLP: "llp" };

/** Colorado codes: D or F (domestic, foreign) then the kind, e.g. DLLC, FPC, DNC. */
export function mapColoradoType(code: string | undefined): Mapped {
  const m = /^([DF])(LLC|PC|NC|LP|LLLP|LLP)$/.exec((code ?? "").trim().toUpperCase());
  if (!m) return NONE;
  const entityType = CO_TYPES[m[2]];
  return { entityType, isForeign: m[1] === "F", isNonprofit: entityType === "nonprofit_corporation" };
}

const CT_TYPES: Record<string, EntityType> = {
  llc: "llc",
  stock: "corporation",
  "non-stock": "nonprofit_corporation",
  "limited partnership": "lp",
  llp: "llp",
  "statutory trust": "business_trust",
};

export function mapConnecticutType(type: string | undefined, citizenship: string | undefined): Mapped {
  const entityType = CT_TYPES[(type ?? "").trim().toLowerCase()];
  if (!entityType) return NONE;
  const c = (citizenship ?? "").trim().toLowerCase();
  return { entityType, isForeign: c === "foreign" ? true : c === "domestic" ? false : null, isNonprofit: entityType === "nonprofit_corporation" };
}

/** Texas Comptroller organizational type codes (Form AP-201). */
const TX_TYPES: Record<string, Mapped> = {
  CL: { entityType: "llc", isForeign: false, isNonprofit: false },
  CI: { entityType: "llc", isForeign: true, isNonprofit: false },
  CT: { entityType: "corporation", isForeign: false, isNonprofit: false },
  CF: { entityType: "corporation", isForeign: true, isNonprofit: false },
  CP: { entityType: "corporation", isForeign: false, isNonprofit: false },
  CN: { entityType: "nonprofit_corporation", isForeign: false, isNonprofit: true },
  CM: { entityType: "nonprofit_corporation", isForeign: true, isNonprofit: true },
  PL: { entityType: "lp", isForeign: false, isNonprofit: false },
  PF: { entityType: "lp", isForeign: true, isNonprofit: false },
  PR: { entityType: "llp", isForeign: false, isNonprofit: false },
  PS: { entityType: "llp", isForeign: true, isNonprofit: false },
  AP: { entityType: "professional_association", isForeign: false, isNonprofit: false },
};

export function mapTexasType(code: string | undefined): Mapped {
  return TX_TYPES[(code ?? "").trim().toUpperCase()] ?? NONE;
}

const TX_TYPE_NAMES: Record<string, string> = {
  CL: "Texas limited liability company",
  CI: "Non-Texas limited liability company",
  CT: "Texas profit corporation",
  CF: "Non-Texas profit corporation",
  CP: "Professional corporation",
  CN: "Texas nonprofit corporation",
  CM: "Non-Texas nonprofit corporation",
  PL: "Limited partnership",
  PF: "Limited partnership",
  PR: "Texas registered limited liability partnership",
  PS: "Non-Texas registered limited liability partnership",
  AP: "Professional association",
};

const CO_TYPE_NAMES: Record<string, string> = {
  LLC: "limited liability company",
  PC: "corporation",
  NC: "nonprofit corporation",
  LP: "limited partnership",
  LLLP: "limited liability limited partnership",
  LLP: "limited liability partnership",
};

function coTypeName(code: string | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  const m = /^([DF])(.+)$/.exec(c);
  if (!m || !CO_TYPE_NAMES[m[2]]) return c;
  return `${m[1] === "F" ? "Foreign" : "Domestic"} ${CO_TYPE_NAMES[m[2]]}`;
}

function sentence(raw: string | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** ISO date from a Socrata floating timestamp; placeholders like 0001-01-01 become null. */
export function isoDate(raw: string | undefined): string | null {
  const d = (raw ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= "1800-01-01" ? d : null;
}

/** Colorado appends events to names of dissolved or lapsed entities ("X LLC, Delinquent May 1, 2020"). */
export function stripColoradoNameSuffix(name: string): string {
  return name.replace(/,?\s+(Delinquent|Dissolved|Withdrawn|Expired|Converted|Merged)\s+[A-Z][a-z]+\s+\d{1,2},\s+\d{4}\s*$/, "").trim();
}

function clean(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function digitsAsIs(min: number, max: number) {
  return (d: string) => (d.length >= min && d.length <= max ? d : null);
}

function hit(base: { number?: string; name: string; typeRaw: string; mapped: Mapped; city?: string; region?: string; county?: string }): RegistryHit | null {
  const entityNumber = clean(base.number);
  if (!entityNumber || !base.name) return null;
  return {
    entityNumber,
    name: base.name,
    typeRaw: base.typeRaw,
    entityType: base.mapped.entityType,
    isForeign: base.mapped.isForeign,
    isNonprofit: base.mapped.isNonprofit,
    city: clean(base.city),
    region: clean(base.region),
    county: clean(base.county),
  };
}


const US_STATE_CODES: Record<string, string> = {
  ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO", CONNECTICUT: "CT",
  DELAWARE: "DE", "DISTRICT OF COLUMBIA": "DC", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL",
  INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
  MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS", MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE",
  NEVADA: "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
  "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA", "PUERTO RICO": "PR",
  "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX", UTAH: "UT",
  VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
};
const US_CODES = new Set(Object.values(US_STATE_CODES));

/** "CO", "co" or "NEW YORK" to a U.S. state code; anything else to "". */
export function regionCode(raw: string | undefined): string {
  const r = clean(raw).toUpperCase();
  if (US_CODES.has(r)) return r;
  return US_STATE_CODES[r] ?? "";
}

/** Placeholders some registers store instead of an address. */
const NO_ADDRESS = /^(no information provided|none|n\/?a|unknown|x+|\.|-+)$/i;

function addrPart(s: string | undefined): string {
  // New York ends street lines with a comma ("606 Wading River Rd,").
  return clean(s).replace(/[\s,]+$/, "");
}

/**
 * A U.S. address the register labels, or null when it has no street, city, state or ZIP we
 * can use (a foreign address, a placeholder, a missing line). Never guessed or completed.
 */
export function usAddress(p: { line1?: string; line2?: string; city?: string; region?: string; zip?: string; country?: string }): RegistryAddress | null {
  const country = clean(p.country).toUpperCase();
  if (country && !["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(country)) return null;
  const line1 = addrPart(p.line1);
  const city = addrPart(p.city);
  const region = regionCode(p.region);
  const zip = clean(p.zip);
  if (!line1 || NO_ADDRESS.test(line1) || !city || NO_ADDRESS.test(city) || !region || !/^\d{5}(-?\d{4})?$/.test(zip)) return null;
  const line2 = addrPart(p.line2);
  return {
    line1,
    line2: NO_ADDRESS.test(line2) ? "" : line2,
    city,
    region,
    postal_code: zip.length === 9 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip,
    county: "",
  };
}

function fullName(...parts: (string | undefined)[]): string {
  return parts.map(clean).filter(Boolean).join(" ");
}

function agentFrom(name: string, address: RegistryAddress | null): RecordDetails["agent"] {
  return name ? { name, address } : null;
}

/** "Mihalas" style casing is left alone; ALL-CAPS names stay as the state stores them. */
function person(name: string, title: string, address?: RegistryAddress | null): RegistryPerson {
  return address ? { name, title, address: addressLine(address) } : { name, title };
}

/** One line for a form field: "3333 NE Sandy Blvd #207, Portland, OR 97232". */
export function addressLine(a: RegistryAddress): string {
  return [a.line1, a.line2, a.city, `${a.region} ${a.postal_code}`.trim()].filter(Boolean).join(", ");
}

/** Connecticut principals (ka36-64k6): officers and directors of a corporation, members or managers of an LLC. */
export function connecticutPrincipals(rows: Row[], entityType: RegistryDetail["entityType"]): { governors: RegistryPerson[]; officers: RegistryPerson[] } {
  const governors: RegistryPerson[] = [];
  const officers: RegistryPerson[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const name = clean(r.name__c) || fullName(r.firstname, r.lastname);
    if (!name || NO_ADDRESS.test(name) || /^john doe$/i.test(name)) continue;
    const designation = clean(r.designation).toLowerCase();
    const address = usAddress({ line1: r.business_street_address_1, line2: r.business_street_address_2, city: r.business_city, region: r.business_state, zip: r.business_zip_code, country: r.business_country });
    const key = `${name.toLowerCase()}|${designation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (entityType === "llc") governors.push(person(name, "Member or manager", address));
    else if (designation.includes("officer") && designation.includes("director")) officers.push(person(name, "Officer and director", address));
    else if (designation.includes("officer")) officers.push(person(name, "Officer", address));
    else if (designation.includes("director")) governors.push(person(name, "Director", address));
  }
  return { governors: governors.slice(0, 20), officers: officers.slice(0, 20) };
}

const STATE_NAMES: Record<string, string> = { CO: "Colorado", CT: "Connecticut", NY: "New York", OR: "Oregon", TX: "Texas" };

export const STATE_DATASETS: Record<string, StateDataset> = {
  // NYS Department of State, "Active Corporations: Beginning 1800" (data.ny.gov).
  NY: {
    code: "NY",
    host: "https://data.ny.gov",
    dataset: "n9v6-gdp6",
    numberField: "dos_id",
    nameField: "current_entity_name",
    upperCaseNames: true,
    select: ["dos_id", "current_entity_name", "entity_type", "initial_dos_filing_date", "county", "jurisdiction"],
    detailSelect: [
      "location_address_1", "location_address_2", "location_city", "location_state", "location_zip",
      "registered_agent_name", "registered_agent_address_1", "registered_agent_address_2", "registered_agent_city", "registered_agent_state", "registered_agent_zip",
      "chairman_name",
    ],
    // "Location" is the principal executive office on New York's record. The chairman's address
    // field often holds the name again, so only the name is taken.
    details: (r) => ({
      principalAddress: usAddress({ line1: r.location_address_1, line2: r.location_address_2, city: r.location_city, region: r.location_state, zip: r.location_zip }),
      agent: agentFrom(
        clean(r.registered_agent_name),
        usAddress({ line1: r.registered_agent_address_1, line2: r.registered_agent_address_2, city: r.registered_agent_city, region: r.registered_agent_state, zip: r.registered_agent_zip }),
      ),
      governors: clean(r.chairman_name) ? [person(clean(r.chairman_name), "Chairman of the board")] : [],
    }),
    number: (d) => digitsAsIs(1, 10)(d.replace(/^0+/, "")),
    map: (r) => mapLongType(r.entity_type),
    toHit: (r) =>
      hit({ number: r.dos_id, name: clean(r.current_entity_name), typeRaw: sentence(r.entity_type), mapped: mapLongType(r.entity_type), county: r.county, region: "NY" }),
    formationDate: (r) => isoDate(r.initial_dos_filing_date),
    jurisdiction: (r) => clean(r.jurisdiction) || null,
  },
  // Colorado Secretary of State, "Business Entities in Colorado" (data.colorado.gov, public domain, daily).
  CO: {
    code: "CO",
    host: "https://data.colorado.gov",
    dataset: "4ykn-tg5h",
    numberField: "entityid",
    nameField: "entityname",
    upperCaseNames: false,
    select: ["entityid", "entityname", "entitytype", "entityformdate", "principalcity", "principalstate", "jurisdictonofformation"],
    detailSelect: [
      "principaladdress1", "principaladdress2", "principalzipcode", "principalcountry",
      "mailingaddress1", "mailingaddress2", "mailingcity", "mailingstate", "mailingzipcode", "mailingcountry",
      "agentfirstname", "agentmiddlename", "agentlastname", "agentsuffix", "agentorganizationname",
      "agentprincipaladdress1", "agentprincipaladdress2", "agentprincipalcity", "agentprincipalstate", "agentprincipalzipcode", "agentprincipalcountry",
    ],
    details: (r) => ({
      principalAddress: usAddress({ line1: r.principaladdress1, line2: r.principaladdress2, city: r.principalcity, region: r.principalstate, zip: r.principalzipcode, country: r.principalcountry }),
      mailingAddress: usAddress({ line1: r.mailingaddress1, line2: r.mailingaddress2, city: r.mailingcity, region: r.mailingstate, zip: r.mailingzipcode, country: r.mailingcountry }),
      agent: agentFrom(
        clean(r.agentorganizationname) || fullName(r.agentfirstname, r.agentmiddlename, r.agentlastname, r.agentsuffix),
        usAddress({ line1: r.agentprincipaladdress1, line2: r.agentprincipaladdress2, city: r.agentprincipalcity, region: r.agentprincipalstate, zip: r.agentprincipalzipcode, country: r.agentprincipalcountry }),
      ),
    }),
    where: "entitystatus in('Good Standing','Delinquent','Noncompliant','Exists')",
    number: digitsAsIs(6, 11),
    map: (r) => mapColoradoType(r.entitytype),
    toHit: (r) =>
      hit({
        number: r.entityid,
        name: stripColoradoNameSuffix(clean(r.entityname)),
        typeRaw: coTypeName(r.entitytype),
        mapped: mapColoradoType(r.entitytype),
        city: r.principalcity,
        region: r.principalstate,
      }),
    formationDate: (r) => isoDate(r.entityformdate),
    jurisdiction: (r) => clean(r.jurisdictonofformation) || null,
  },
  // Connecticut Secretary of the State, "Business Registry - Business Master" (data.ct.gov, public domain, daily).
  CT: {
    code: "CT",
    host: "https://data.ct.gov",
    dataset: "n7gp-d28j",
    numberField: "accountnumber",
    nameField: "name",
    upperCaseNames: false,
    select: ["accountnumber", "name", "business_type", "citizenship", "date_registration", "billingcity", "billingstate", "state_or_territory_formation"],
    // "Business" street, unit, city, state, ZIP on Connecticut's record; principals are read
    // separately (CT_PRINCIPALS) by the master record's id.
    detailSelect: ["id", "billingstreet", "billing_unit", "billingpostalcode", "billingcountry"],
    details: (r) => ({
      principalAddress: usAddress({ line1: r.billingstreet, line2: r.billing_unit, city: r.billingcity, region: r.billingstate, zip: r.billingpostalcode, country: r.billingcountry }),
    }),
    where: "status = 'Active'",
    // Stored zero-padded to 7 digits ("0975250").
    number: (d) => (d.length >= 4 && d.length <= 10 ? d.padStart(7, "0") : null),
    map: (r) => mapConnecticutType(r.business_type, r.citizenship),
    toHit: (r) => {
      const mapped = mapConnecticutType(r.business_type, r.citizenship);
      const citizenship = clean(r.citizenship);
      return hit({
        number: r.accountnumber,
        name: clean(r.name),
        typeRaw: [citizenship, clean(r.business_type)].filter(Boolean).join(" "),
        mapped,
        city: r.billingcity,
        region: r.billingstate,
      });
    },
    formationDate: (r) => isoDate(r.date_registration),
    jurisdiction: (r) => clean(r.state_or_territory_formation) || null,
  },
  // Oregon Secretary of State, "Active Businesses - ALL" (data.oregon.gov). One row per name or address on file.
  OR: {
    code: "OR",
    host: "https://data.oregon.gov",
    dataset: "tckn-sxa6",
    numberField: "registry_number",
    nameField: "business_name",
    upperCaseNames: true,
    select: ["registry_number", "business_name", "entity_type", "registry_date", "jurisdiction", "associated_name_type", "city", "state"],
    // One row per labeled address: PRINCIPAL PLACE OF BUSINESS, MAILING ADDRESS, REGISTERED AGENT.
    detailSelect: ["address", "address_continued", "zip", "first_name", "middle_name", "last_name", "suffix", "entity_of_record_name"],
    details: (_r, all) => {
      const of = (type: string) => all.find((x) => clean(x.associated_name_type).toUpperCase() === type);
      const at = (x: Row | undefined) => (x ? usAddress({ line1: x.address, line2: x.address_continued, city: x.city, region: x.state, zip: x.zip }) : null);
      const agentRow = of("REGISTERED AGENT");
      return {
        principalAddress: at(of("PRINCIPAL PLACE OF BUSINESS")),
        mailingAddress: at(of("MAILING ADDRESS")),
        agent: agentRow ? agentFrom(clean(agentRow.entity_of_record_name) || fullName(agentRow.first_name, agentRow.middle_name, agentRow.last_name, agentRow.suffix), at(agentRow)) : null,
      };
    },
    where: "entity_type != 'ASSUMED BUSINESS NAME'",
    number: digitsAsIs(4, 10),
    map: (r) => mapLongType(r.entity_type),
    toHit: (r) => {
      const place = /PRINCIPAL PLACE OF BUSINESS/i.test(r.associated_name_type ?? "");
      return hit({
        number: r.registry_number,
        name: clean(r.business_name),
        typeRaw: sentence(r.entity_type),
        mapped: mapLongType(r.entity_type),
        city: place ? r.city : "",
        region: place ? r.state : "",
      });
    },
    formationDate: (r) => isoDate(r.registry_date),
    jurisdiction: (r) => clean(r.jurisdiction) || null,
  },
  // Texas Comptroller, "Active Franchise Taxpayers" (data.texas.gov). The SOS file number is the entity number.
  TX: {
    code: "TX",
    host: "https://data.texas.gov",
    dataset: "9cir-efmm",
    numberField: "secretary_of_state_sos_or_coa_file_number",
    nameField: "taxpayer_name",
    upperCaseNames: true,
    select: ["secretary_of_state_sos_or_coa_file_number", "taxpayer_name", "taxpayer_organizational_type", "sos_charter_date", "taxpayer_city", "taxpayer_state"],
    // The Comptroller lists one address, the taxpayer's mailing address. No agent, no people.
    detailSelect: ["taxpayer_address", "taxpayer_zip"],
    details: (r) => ({
      mailingAddress: usAddress({ line1: r.taxpayer_address, city: r.taxpayer_city, region: r.taxpayer_state, zip: r.taxpayer_zip }),
    }),
    where: "secretary_of_state_sos_or_coa_file_number IS NOT NULL",
    number: (d) => (d.length >= 4 && d.length <= 10 ? d.padStart(10, "0") : null),
    map: (r) => mapTexasType(r.taxpayer_organizational_type),
    toHit: (r) => {
      const code = clean(r.taxpayer_organizational_type).toUpperCase();
      return hit({
        number: r.secretary_of_state_sos_or_coa_file_number,
        name: clean(r.taxpayer_name),
        typeRaw: TX_TYPE_NAMES[code] ?? code,
        mapped: mapTexasType(code),
        city: r.taxpayer_city,
        region: r.taxpayer_state,
      });
    },
    formationDate: (r) => isoDate(r.sos_charter_date),
    // Domestic entities formed in Texas; the dataset doesn't say where a foreign one formed.
    jurisdiction: (r) => (mapTexasType(r.taxpayer_organizational_type).isForeign === false ? "Texas" : null),
  },
};

export function stateDataset(code: string): StateDataset | null {
  return STATE_DATASETS[code.toUpperCase()] ?? null;
}

/** "Texas" for a domestic record's stated jurisdiction code ("CO", "OR", "New York"). */
export function jurisdictionName(code: string, raw: string | null): string | null {
  if (!raw) return null;
  const r = raw.trim();
  if (/^[A-Z]{2}$/.test(r)) return r === code ? STATE_NAMES[code] ?? r : r;
  return r;
}

/** Typed search text to a number lookup or an upper-case name prefix. */
export function parseStateQuery(ds: StateDataset, q: string): { kind: "number"; value: string } | { kind: "name"; value: string } | null {
  const trimmed = q.replace(/\s+/g, " ").trim().slice(0, 100);
  const digits = trimmed.replace(/[\s-]/g, "");
  if (/^\d+$/.test(digits) && digits.length >= 4) {
    const n = ds.number(digits);
    return n ? { kind: "number", value: n } : null;
  }
  const name = trimmed.replace(/[^A-Za-z0-9 &.,'-]/g, "").trim();
  if (name.replace(/[^A-Za-z0-9]/g, "").length < 3) return null;
  return { kind: "name", value: name.toUpperCase() };
}

/** Collapse rows for one entity (Oregon has several) into a record, preferring the place of business row. */
export function toStateDetail(ds: StateDataset, rows: Row[]): RegistryDetail | null {
  const hits = rows.map((r) => ({ r, h: ds.toHit(r) })).filter((x): x is { r: Row; h: RegistryHit } => x.h !== null);
  if (hits.length === 0) return null;
  const best = hits.find((x) => x.h.city) ?? hits[0];
  const juris = jurisdictionName(ds.code, ds.jurisdiction(best.r));
  const extra = ds.details?.(best.r, rows) ?? {};
  return {
    ...best.h,
    formationDate: ds.formationDate(best.r),
    jurisdictionOfFormation: juris,
    addressOnRecord: null,
    governors: extra.governors ?? [],
    officers: extra.officers ?? [],
    principalAddress: extra.principalAddress ?? null,
    mailingAddress: extra.mailingAddress ?? null,
    agent: extra.agent ?? null,
  };
}

/** Connecticut's principals dataset, keyed by the master record's id (not the business ID). */
export const CT_PRINCIPALS = {
  host: "https://data.ct.gov",
  dataset: "ka36-64k6",
  select: ["name__c", "firstname", "lastname", "designation", "business_street_address_1", "business_street_address_2", "business_city", "business_state", "business_zip_code", "business_country"],
} as const;

/** Unique hits in order, keeping the row that has a place when an entity appears twice. */
export function uniqueHits(ds: StateDataset, rows: Row[], limit = 15): RegistryHit[] {
  const byNumber = new Map<string, RegistryHit>();
  for (const r of rows) {
    const h = ds.toHit(r);
    if (!h) continue;
    const prev = byNumber.get(h.entityNumber);
    if (!prev || (!prev.city && h.city)) byNumber.set(h.entityNumber, h);
  }
  return [...byNumber.values()].slice(0, limit);
}
