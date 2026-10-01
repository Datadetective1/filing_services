import type { EntityType } from "@/lib/domain/types";

/**
 * Pure mapping of the Pennsylvania Department of State open dataset
 * "Registered Businesses in PA Current by County" (data.pa.gov, public domain, refreshed
 * monthly) into Filewell's shapes. No network code here, so it is unit-testable.
 *
 * What the dataset is and is not (verified 2026-09-30):
 *  - One row per governor/principal officer (or a single row with party_type null).
 *  - Has: business_name (title-cased, not the exact legal-name casing), filing_number
 *    (the entity number, zero-padded), one street address, county, registration type,
 *    creation date, and person names with a title in party_type.
 *  - Has NOT: status/standing, annual-report history, which address the street address
 *    is (most likely the registered office), email or phone. It lists current
 *    registrations only and can lag the live register by up to a month.
 */

export const PA_OPEN_DATA = {
  /** One row per person (detail). */
  detailDataset: "xvd7-5r2c",
  /** One row per business (search). */
  searchDataset: "3urc-uaba",
  host: "https://data.pa.gov",
  sourceName: "pa_dos_open_data",
  sourceLabel: "Pennsylvania Department of State business register (data.pa.gov, updated monthly)",
  datasetUrl: "https://data.pa.gov/Licenses-Certificates/Registered-Businesses-in-PA-Current-by-County-Depa/xvd7-5r2c",
  licence: "Public Domain U.S. Government (data.pa.gov)",
} as const;

export interface PaOpenDataRow {
  business_name?: string;
  filing_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  typeofbusinessregistration?: string;
  creationdate?: string;
  party_type?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  shortcountyname?: string;
}

export interface RegistryAddress {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal_code: string;
  county: string;
}

export interface RegistryPerson {
  name: string;
  title: string;
}

export interface RegistryHit {
  entityNumber: string;
  name: string;
  typeRaw: string;
  entityType: EntityType | null;
  isForeign: boolean | null;
  isNonprofit: boolean;
  city: string;
  region: string;
  county: string;
}

export interface RegistryDetail extends RegistryHit {
  formationDate: string | null;
  /** Domestic: "Pennsylvania". Foreign: unknown (the dataset doesn't say), so null. */
  jurisdictionOfFormation: string | null;
  /** The single street address on the record (most likely the registered office). */
  addressOnRecord: RegistryAddress | null;
  governors: RegistryPerson[];
  officers: RegistryPerson[];
}

const TYPE_MAP: Record<string, { entityType: EntityType | null; isNonprofit?: boolean }> = {
  "limited liability company": { entityType: "llc" },
  "business corporation": { entityType: "corporation" },
  "nonprofit corporation": { entityType: "nonprofit_corporation", isNonprofit: true },
  "limited partnership (lp/lllp)": { entityType: "lp" },
  "limited partnership": { entityType: "lp" },
  "limited liability general partnership": { entityType: "llp" },
  "business trust": { entityType: "business_trust" },
  "professional association": { entityType: "professional_association" },
};

/** "Domestic Limited Liability Company" -> llc, domestic. Unknown or unsupported types -> null. */
export function mapRegistrationType(raw: string | undefined): { entityType: EntityType | null; isForeign: boolean | null; isNonprofit: boolean } {
  const t = (raw ?? "").trim().toLowerCase();
  const isForeign = t.startsWith("foreign ") ? true : t.startsWith("domestic ") ? false : null;
  const rest = t.replace(/^(domestic|foreign)\s+/, "");
  const hit = TYPE_MAP[rest];
  return { entityType: hit?.entityType ?? null, isForeign, isNonprofit: Boolean(hit?.isNonprofit) };
}

const GOVERNOR_TITLES = new Set([
  "governor", "member", "managing member", "sole member", "manager", "director", "board member", "trustee", "general partner",
]);
const OFFICER_TITLES = new Set([
  "president", "vice president", "senior vice president", "executive vice president", "treasurer", "assistant treasurer",
  "secretary", "assistant secretary", "ceo", "chief executive officer", "cfo", "chief financial officer", "coo",
  "chief operating officer", "officer", "executive director", "chairman", "chair", "chairperson",
]);

/** Governor, officer, or neither (organizer, incorporator, owner, blank: not current governance). */
export function classifyParty(partyType: string | undefined): "governor" | "officer" | null {
  const t = (partyType ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (GOVERNOR_TITLES.has(t)) return "governor";
  if (OFFICER_TITLES.has(t)) return "officer";
  return null;
}

const SUFFIXES: Record<string, string> = { llc: "LLC", "l.l.c.": "L.L.C.", lp: "LP", llp: "LLP", lllp: "LLLP", pllc: "PLLC", pc: "PC", "p.c.": "P.C.", inc: "Inc", "inc.": "Inc." };

/** The dataset title-cases names ("Daff Trucking Llc"); restore common suffix casing. */
export function tidyBusinessName(name: string | undefined): string {
  return (name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => SUFFIXES[w.toLowerCase()] ?? w)
    .join(" ");
}

function titleWord(w: string): string {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function personName(r: PaOpenDataRow): string {
  return [r.first_name, r.middle_name, r.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");
}

function normTitle(partyType: string): string {
  return partyType.trim().toLowerCase().replace(/\s+/g, " ").split(" ").map(titleWord).join(" ").replace(/\b(Ceo|Cfo|Coo)\b/g, (m) => m.toUpperCase());
}

/** Search queries are only letters, digits, spaces and a little punctuation; SoQL-quoted. */
export function normalizeSearchQuery(q: string): { kind: "number"; value: string } | { kind: "name"; value: string } | null {
  const trimmed = q.replace(/\s+/g, " ").trim().slice(0, 100);
  const digits = trimmed.replace(/[\s-]/g, "");
  if (/^\d{4,10}$/.test(digits)) return { kind: "number", value: digits.padStart(10, "0") };
  const name = trimmed.replace(/[^A-Za-z0-9 &.,'-]/g, "").trim();
  if (name.replace(/[^A-Za-z0-9]/g, "").length < 3) return null;
  return { kind: "name", value: name.toUpperCase() };
}

/** Quote a value for a SoQL string literal (single quotes doubled; LIKE wildcards stripped). */
export function soqlString(value: string): string {
  return `'${value.replace(/[%_]/g, "").replace(/'/g, "''")}'`;
}

/** A SoQL LIKE prefix pattern: the value (wildcards stripped, quotes doubled) followed by %. */
export function soqlPrefix(value: string): string {
  return `'${value.replace(/[%_]/g, "").replace(/'/g, "''")}%'`;
}

export function toHit(r: PaOpenDataRow): RegistryHit | null {
  if (!r.filing_number || !r.business_name) return null;
  const t = mapRegistrationType(r.typeofbusinessregistration);
  return {
    entityNumber: r.filing_number.trim(),
    name: tidyBusinessName(r.business_name),
    typeRaw: (r.typeofbusinessregistration ?? "").trim(),
    entityType: t.entityType,
    isForeign: t.isForeign,
    isNonprofit: t.isNonprofit,
    city: (r.city ?? "").trim(),
    region: (r.state ?? "").trim(),
    county: (r.shortcountyname ?? "").trim(),
  };
}

/** Collapse the per-person rows of one entity into a single record. */
export function toDetail(rows: PaOpenDataRow[]): RegistryDetail | null {
  const first = rows.find((r) => r.filing_number && r.business_name);
  if (!first) return null;
  const hit = toHit(first)!;
  const governors: RegistryPerson[] = [];
  const officers: RegistryPerson[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const name = personName(r);
    const kind = classifyParty(r.party_type);
    if (!name || !kind || !r.party_type) continue;
    const title = normTitle(r.party_type);
    const key = `${kind}|${name.toLowerCase()}|${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (kind === "governor" ? governors : officers).push({ name, title });
  }
  const line1 = (first.address_line1 ?? "").trim();
  const addressOnRecord: RegistryAddress | null = line1
    ? {
        line1,
        line2: (first.address_line2 ?? "").trim(),
        city: (first.city ?? "").trim(),
        region: (first.state ?? "").trim(),
        postal_code: (first.zip ?? "").trim(),
        county: (first.shortcountyname ?? "").trim(),
      }
    : null;
  const created = (first.creationdate ?? "").slice(0, 10);
  return {
    ...hit,
    formationDate: /^\d{4}-\d{2}-\d{2}$/.test(created) ? created : null,
    jurisdictionOfFormation: hit.isForeign === false ? "Pennsylvania" : null,
    addressOnRecord,
    governors: governors.slice(0, 20),
    officers: officers.slice(0, 20),
  };
}
