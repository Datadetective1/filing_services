import type { EntityType, ISODate } from "@/lib/domain/types";
import type { Situation } from "./segment";

/**
 * Physical-mail pilot: Pennsylvania associations with a December 31 annual-report deadline
 * (LPs, LLPs, electing partnerships, professional associations, business trusts), chosen
 * from the Department of State open dataset. Pure functions only.
 *
 * The dataset is monthly and has no standing or filing history, so a piece is never sent
 * because a report "is" due: the card says it MAY be due. Exclusions are explicit and
 * exported with every row.
 */

export const DEC31_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(["lp", "llp", "electing_partnership", "professional_association", "business_trust"]);

/** Mail early enough to act on, never after the deadline. */
export const MAIL_WINDOW_DAYS = 120;

/** This many or more entities at one street address: most likely a registered agent or CROP, not the owner. */
export const SHARED_ADDRESS_THRESHOLD = 3;

export type MailExclusion =
  | "unsupported_type"
  | "not_dec31_deadline"
  | "first_year"
  | "deadline_passed"
  | "too_early"
  | "verified_filed"
  | "existing_customer"
  | "no_address"
  | "incomplete_address"
  | "non_us_address"
  | "shared_address"
  | "agent_address";

export const MAIL_EXCLUSION_TEXT: Record<MailExclusion, string> = {
  unsupported_type: "Registration type we don't handle",
  not_dec31_deadline: "Deadline is not December 31",
  first_year: "First-year entity: first report not due yet",
  deadline_passed: "Deadline already passed",
  too_early: `Deadline more than ${MAIL_WINDOW_DAYS} days away`,
  verified_filed: "A real-time source verified this year's report",
  existing_customer: "Already a Filewell customer",
  no_address: "No address on the record",
  incomplete_address: "Address incomplete (street, city, state or ZIP missing)",
  non_us_address: "Address outside the U.S.",
  shared_address: `${SHARED_ADDRESS_THRESHOLD}+ entities at this address (likely a registered agent or CROP)`,
  agent_address: "Care-of or agent-service address (reaches an agent or attorney, not the owner)",
};

const US_STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP".split(" "),
);

export interface RecordAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  county?: string;
}

/** Key for spotting many entities at one address (street + 5-digit ZIP, normalized). */
export function addressKey(a: RecordAddress | null | undefined): string | null {
  if (!a?.line1 || !a.postal_code) return null;
  const street = a.line1
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(suite|ste|unit|apt|floor|fl|room|rm)\b.*$/, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\s+/g, " ")
    .trim();
  const zip = a.postal_code.replace(/\D/g, "").slice(0, 5);
  return street && zip.length === 5 ? `${street}|${zip}` : null;
}

export function mailExclusions(input: {
  entityType: EntityType | null;
  address: RecordAddress | null;
  situation: Situation;
  isCustomer: boolean;
  sharedCount: number;
}): MailExclusion[] {
  const out: MailExclusion[] = [];
  const s = input.situation;
  if (!input.entityType || s.kind !== "assessed") out.push("unsupported_type");
  else {
    if (!DEC31_ENTITY_TYPES.has(input.entityType)) out.push("not_dec31_deadline");
    if (s.firstReportLater) out.push("first_year");
    else if (s.daysRemaining < 0) out.push("deadline_passed");
    else if (s.daysRemaining > MAIL_WINDOW_DAYS) out.push("too_early");
    if (s.filed === true) out.push("verified_filed");
  }
  if (input.isCustomer) out.push("existing_customer");
  const a = input.address;
  if (!a?.line1) out.push("no_address");
  else {
    const zip = (a.postal_code ?? "").replace(/\D/g, "");
    if (!a.city || !a.region || zip.length < 5) out.push("incomplete_address");
    else if (!US_STATES.has(a.region.toUpperCase())) out.push("non_us_address");
    if (input.sharedCount >= SHARED_ADDRESS_THRESHOLD) out.push("shared_address");
    if (isAgentLine(a.line1) || isAgentLine(a.line2)) out.push("agent_address");
  }
  return out;
}

const AGENT_LINE = /^\s*(c\/o|c\.o\.|care of|attn:?)(\s|\b)|\b(registered agents?|incorporating services|corporation service company|ct corporation|national registered|commercial registered office|statutory agent)\b/i;

/** Address lines that route mail to an agent or attorney rather than the business. */
export function isAgentLine(line: string | undefined): boolean {
  return Boolean(line && AGENT_LINE.test(line));
}

export function formatMailAddress(a: RecordAddress): string {
  const zip = (a.postal_code ?? "").replace(/[^\d-]/g, "").replace(/-0*$/, "");
  return [a.line1, a.line2, `${a.city ?? ""}, ${(a.region ?? "").toUpperCase()} ${zip}`.trim()].filter((x) => x && x.trim()).join(", ");
}

/** ISO date helper for the export (deadline column). */
export function deadlineText(s: Situation): ISODate | "" {
  return s.kind === "assessed" ? s.dueDate : "";
}

// ---------------------------------------------------------------------------
// Pilot cohort: stricter rules on top of mailExclusions, for a small clean first test.
// ---------------------------------------------------------------------------

export type CohortExclusion =
  | MailExclusion
  | "foreign_entity"
  | "outside_pennsylvania"
  | "po_box"
  | "no_street_number"
  | "duplicate_address"
  | "address_too_long"
  | "name_type_mismatch"
  | "government_like_name"
  | "personal_name"
  | "questionable_record"
  | "name_too_long";

export const COHORT_EXCLUSION_TEXT: Record<CohortExclusion, string> = {
  ...MAIL_EXCLUSION_TEXT,
  foreign_entity: "Foreign registration (pilot uses domestic entities only)",
  outside_pennsylvania: "Address outside Pennsylvania (pilot uses PA addresses only)",
  po_box: "P.O. box (pilot uses street addresses only)",
  no_street_number: "Street line doesn't start with a building number",
  duplicate_address: "Another registered entity uses this address (anywhere in the register)",
  address_too_long: "Address lines longer than the mail vendor allows (50 characters)",
  name_type_mismatch: "Name suggests a different entity type than the registration (questionable record)",
  government_like_name: "Name sounds like a public body (never solicit these)",
  personal_name: "Registered under what looks like a person's name (avoid mailing individuals)",
  questionable_record: "Name contains data-entry artifacts (questionable record)",
  name_too_long: "Name longer than the mail vendor's 40-character recipient field",
};

/** Names ending like an LLC or corporation on a partnership/trust registration. */
const OTHER_TYPE_SUFFIX = /\b(l\.?\s?l\.?\s?c|inc|incorporated|corp|corpor\w*|corporation|company|co)\.?\s*$/i;
const PUBLIC_BODY = /\b(task force|police|sheriff|county|township|borough|municipal|authority|commonwealth|department|state of|federal|government|school district|court|agency|bureau|fire company|volunteer fire)\b/i;

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s*office\s*box|box\s+\d+)\b/i;

/**
 * Cohort exclusions. `registerAddressCount` is how many entities in the WHOLE register
 * (all types) use this street address and ZIP, so any address shared with another entity
 * (agents, CROPs, offices) is left out.
 */
export function cohortExclusions(
  input: Parameters<typeof mailExclusions>[0] & { isForeign: boolean | null; registerAddressCount: number; legalName?: string },
): CohortExclusion[] {
  const out: CohortExclusion[] = [...mailExclusions(input)];
  const name = input.legalName ?? "";
  if (name && input.entityType && DEC31_ENTITY_TYPES.has(input.entityType) && OTHER_TYPE_SUFFIX.test(name)) out.push("name_type_mismatch");
  if (PUBLIC_BODY.test(name)) out.push("government_like_name");
  if (looksLikePersonalName(name)) out.push("personal_name");
  if (/[_@#*]/.test(name)) out.push("questionable_record");
  if (name.length > 40) out.push("name_too_long");
  if (input.isForeign !== false) out.push("foreign_entity");
  const a = input.address;
  if (a?.line1) {
    if ((a.region ?? "").toUpperCase() !== "PA") out.push("outside_pennsylvania");
    if (PO_BOX.test(`${a.line1} ${a.line2 ?? ""}`)) out.push("po_box");
    else if (!/^\d/.test(a.line1.trim())) out.push("no_street_number");
    if (`${a.line1}${a.line2 ?? ""}`.length > 50) out.push("address_too_long");
    if (input.registerAddressCount > 1 && !out.includes("shared_address")) out.push("duplicate_address");
  }
  return [...new Set(out)];
}

const BUSINESS_WORD = /\b(lp|lllp|llp|ltd|limited|partners?|partnership|group|services?|properties|property|rentals?|farms?|family|enterprises?|associates|holdings?|ventures?|company|co|trust|llc|inc|corp|realty|investments?|management|consulting|auto|care|home|construction|logistics|trucking|express|entertainment|music|studio|solutions|cleaning|repair|salon|spa|nails|books?|boutique|towing|plumbing|equipment|outdoor|lawn|landscaping|shipping|transportation|pizzeria|news|manor|club)\b/i;

/** Common U.S. first names (lower case), for spotting registrations under a person's name. */
const FIRST_NAMES = new Set(
  (
    "james john robert michael william david richard joseph thomas charles christopher daniel matthew anthony mark donald steven paul andrew joshua kenneth kevin brian george timothy ronald edward jason jeffrey ryan jacob gary nicholas eric jonathan stephen larry justin scott brandon benjamin samuel gregory alexander frank patrick raymond jack dennis jerry tyler aaron jose adam nathan henry douglas zachary peter kyle noah ethan jeremy walter christian keith roger terry austin sean gerald carl harold dylan arthur lawrence jordan jesse bryan billy bruce gabriel joe logan alan juan albert willie elijah wayne randy vincent mason roy ralph bobby russell bradley philip eugene " +
    "mary patricia jennifer linda elizabeth barbara susan jessica sarah karen lisa nancy betty sandra margaret ashley kimberly emily donna michelle carol amanda melissa deborah stephanie dorothy rebecca sharon laura cynthia amy kathleen angela shirley brenda emma anna pamela nicole samantha katherine christine helen debra rachel carolyn janet maria catherine heather diane olivia julie joyce victoria ruth virginia lauren kelly christina joan evelyn judith andrea hannah megan cheryl jacqueline martha madison teresa gloria sara janice ann kathryn abigail sophia frances jean alice judy isabella julia grace amber denise danielle marilyn beverly charlotte natalie theresa diana brittany doris kayla alexis lori marie valerie florence " +
    "luis carlos jorge miguel pedro ramon rosa ana carmen lerida felipe javier manuel francisco angel ricardo eduardo fernando sergio raul"
  ).split(/\s+/),
);

/** A registration under what looks like an individual's name ("Jesse Jones", "Florence J Lawson"). */
export function looksLikePersonalName(name: string): boolean {
  const n = name.trim();
  if (!n || BUSINESS_WORD.test(n) || /[&,0-9]/.test(n)) return false;
  const m = /^([A-Z][a-z'-]+)(\s+[A-Z]\.?)?\s+[A-Z][a-z'-]+$/.exec(n);
  return Boolean(m && (FIRST_NAMES.has(m[1].toLowerCase()) || m[2]));
}

/** Stable pseudo-random order (FNV-1a of the entity number), so a cohort is reproducible and unbiased. */
export function cohortOrder(entityNumber: string): number {
  let h = 0x811c9dc5;
  for (const ch of entityNumber) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Pick `size` eligible rows in stable order; everything else keeps its reasons. */
export function selectCohort<T extends { entityNumber: string; exclusions: CohortExclusion[] }>(rows: T[], size: number): { selected: T[]; excluded: T[] } {
  const eligible = rows.filter((r) => r.exclusions.length === 0).sort((a, b) => cohortOrder(a.entityNumber) - cohortOrder(b.entityNumber));
  const selected = eligible.slice(0, size);
  const chosen = new Set(selected.map((r) => r.entityNumber));
  return { selected, excluded: rows.filter((r) => !chosen.has(r.entityNumber)) };
}
