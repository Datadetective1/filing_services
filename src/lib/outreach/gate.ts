import type { CampaignSegment, EntityGroup, Situation } from "./segment";

/**
 * Outreach compliance gate (pure). A prospect email can only be sent when EVERY check
 * passes; otherwise the dry run records exactly why not.
 *
 * Campaign-level gates (block everyone):
 *  - campaign_not_approved   approved by an admin, and the content unchanged since approval
 *  - no_postal_address       CAN-SPAM requires a valid physical postal address in the email
 *  - no_marketing_provider   Resend's acceptable-use policy forbids cold outreach, so a
 *                            separate provider (owner-approved) is required
 *  - invalid_sender          From must be a Filewell domain and never look governmental
 *  - sends_disabled          MARKETING_SENDS_ENABLED must be "true" (it is not)
 *
 * Recipient-level gates: known record source, a business email with a known source whose
 * licence permits marketing, not suppressed, not already a customer, in the segment.
 */

export type CampaignGate = "campaign_not_approved" | "no_postal_address" | "no_marketing_provider" | "invalid_sender" | "sends_disabled";
export type RecipientGate =
  | "record_source_unknown"
  | "not_in_segment"
  | "entity_group_mismatch"
  | "no_email"
  | "email_invalid"
  | "not_business_contact"
  | "contact_source_unknown"
  | "licence_not_marketing"
  | "suppressed"
  | "existing_customer";

export const GATE_TEXT: Record<CampaignGate | RecipientGate, string> = {
  campaign_not_approved: "Campaign not approved (or changed since approval)",
  no_postal_address: "No public postal address configured (CAN-SPAM requires one)",
  no_marketing_provider: "No marketing email provider approved (Resend forbids cold outreach)",
  invalid_sender: "Sender identity not configured or not allowed",
  sends_disabled: "Real sending is switched off (dry run only)",
  record_source_unknown: "Register record has no known source",
  not_in_segment: "Not in this campaign's segment",
  entity_group_mismatch: "Different entity type from the campaign",
  no_email: "No business email on file",
  email_invalid: "Email address is not valid",
  not_business_contact: "Contact is not a business contact",
  contact_source_unknown: "Email has no known source",
  licence_not_marketing: "Email source does not permit marketing use",
  suppressed: "On the do-not-contact list",
  existing_customer: "Already a Filewell customer",
};

export interface GateConfig {
  postalAddress: string | null;
  marketingProvider: string | null;
  marketingFrom: string | null;
  sendsEnabled: boolean;
}

export interface CampaignForGate {
  status: string;
  approvedContentSha256: string | null;
  currentContentSha256: string;
  segment: CampaignSegment;
  entityGroup: EntityGroup | "all";
}

export interface RecipientForGate {
  recordSource: string | null;
  situation: Situation;
  email: { value: string; source: string | null; licenceUse: string; isBusinessContact: boolean } | null;
  suppressed: boolean;
  isCustomer: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const GOVERNMENT_LOOKING = /(\.gov\b|\bgov\b|commonwealth|department|state of|dos\b|bureau|notice)/i;

export function senderIsValid(from: string | null): boolean {
  if (!from) return false;
  const m = /<([^>]+)>$/.exec(from.trim());
  const address = (m ? m[1] : from).trim().toLowerCase();
  const display = m ? from.slice(0, from.indexOf("<")).trim() : "";
  if (!EMAIL_RE.test(address)) return false;
  const domain = address.split("@")[1];
  if (!(domain === "getfilewell.com" || domain.endsWith(".getfilewell.com"))) return false;
  return !GOVERNMENT_LOOKING.test(display) && !GOVERNMENT_LOOKING.test(address);
}

export function campaignGates(c: CampaignForGate, cfg: GateConfig): CampaignGate[] {
  const out: CampaignGate[] = [];
  if (c.status !== "approved" || !c.approvedContentSha256 || c.approvedContentSha256 !== c.currentContentSha256) out.push("campaign_not_approved");
  if (!cfg.postalAddress?.trim()) out.push("no_postal_address");
  if (!cfg.marketingProvider || cfg.marketingProvider.toLowerCase() === "resend") out.push("no_marketing_provider");
  if (!senderIsValid(cfg.marketingFrom)) out.push("invalid_sender");
  if (!cfg.sendsEnabled) out.push("sends_disabled");
  return out;
}

export function recipientGates(c: Pick<CampaignForGate, "segment" | "entityGroup">, r: RecipientForGate): RecipientGate[] {
  const out: RecipientGate[] = [];
  if (!r.recordSource) out.push("record_source_unknown");
  if (r.situation.kind !== "assessed" || r.situation.segment !== c.segment) out.push("not_in_segment");
  if (c.entityGroup !== "all" && (r.situation.kind !== "assessed" || r.situation.group !== c.entityGroup)) out.push("entity_group_mismatch");
  if (r.isCustomer) out.push("existing_customer");
  if (!r.email) out.push("no_email");
  else {
    if (!EMAIL_RE.test(r.email.value)) out.push("email_invalid");
    if (!r.email.isBusinessContact) out.push("not_business_contact");
    if (!r.email.source) out.push("contact_source_unknown");
    if (r.email.licenceUse !== "marketing_permitted") out.push("licence_not_marketing");
    if (r.suppressed) out.push("suppressed");
  }
  return out;
}

/** Final decision: send only when there are no campaign gates and no recipient gates. */
export function decide(campaign: CampaignGate[], recipient: RecipientGate[]): { send: boolean; reasons: (CampaignGate | RecipientGate)[] } {
  const reasons = [...recipient, ...campaign];
  return { send: reasons.length === 0, reasons };
}
