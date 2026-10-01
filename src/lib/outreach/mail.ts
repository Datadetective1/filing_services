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
