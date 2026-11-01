import type { EntityType } from "@/lib/domain/types";
import type { RegistryDetail, RegistryHit } from "./pa-open-data-map";

/**
 * Pure mapping for the other states' official open business datasets (Socrata, queried
 * live, nothing stored). Pennsylvania keeps its own module (pa-open-data-map.ts) because
 * its dataset carries people and addresses that feed intake prefill.
 *
 * Every dataset below was read on 2026-11-01. Fields we never request: email, phone,
 * people. We only take what the lookup needs: name, number, type, formation date, place.
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
  /** Keeps current registrations only (and drops rows that aren't an entity). */
  where?: string;
  /** Typed digits to the dataset's stored number, or null when it can't be one. */
  number(digits: string): string | null;
  map(row: Row): Mapped;
  toHit(row: Row): RegistryHit | null;
  formationDate(row: Row): string | null;
  jurisdiction(row: Row): string | null;
}

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
  return {
    ...best.h,
    formationDate: ds.formationDate(best.r),
    jurisdictionOfFormation: juris,
    addressOnRecord: null,
    governors: [],
    officers: [],
  };
}

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
