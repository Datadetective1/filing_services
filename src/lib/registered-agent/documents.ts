/**
 * Registered agent documents: what arrives for a customer's business and how fast an
 * operator must act on it.
 *
 * No delivery time is promised to customers. Registered Agents Inc.'s document-delivery
 * timing is not confirmed, and Filewell has no operating history yet. The thresholds below
 * are INTERNAL escalation targets for operators (docs/REGISTERED_AGENT.md), not service
 * levels, and never appear in customer copy.
 */

export const SERVICE_DOCUMENT_KINDS = [
  "service_of_process",
  "government_notice",
  "regular_mail",
  "filing_confirmation",
  "business_record",
] as const;
export type ServiceDocumentKind = (typeof SERVICE_DOCUMENT_KINDS)[number];

export const SERVICE_DOCUMENT_KIND_LABELS: Record<ServiceDocumentKind, string> = {
  service_of_process: "Legal document (service of process)",
  government_notice: "Government notice",
  regular_mail: "Regular mail",
  filing_confirmation: "Filing confirmation",
  business_record: "Business record",
};

export type Urgency = "urgent" | "high" | "normal";

/**
 * Service of process can start a court deadline, so it is always urgent. Government
 * notices (tax, state compliance) are high. Regular mail is never treated as either,
 * and never billed as one: the extra-mail charge applies only to regular mail.
 */
export function urgencyFor(kind: ServiceDocumentKind): Urgency {
  if (kind === "service_of_process") return "urgent";
  if (kind === "government_notice") return "high";
  return "normal";
}

export function isBillableMail(kind: ServiceDocumentKind): boolean {
  return kind === "regular_mail";
}

/**
 * Regular mail included per client per service year before the per-item charge applies
 * (provider terms as reviewed Oct 29, 2026; not verified until the agreement is signed).
 * Legal documents and government notices are never counted or charged.
 */
export const INCLUDED_REGULAR_MAIL_PER_YEAR = 3;

/** Whether this regular mail item is beyond the included ones (itemNumber counts from 1 within the service year). */
export function mailItemBillable(kind: ServiceDocumentKind, itemNumberThisServiceYear: number): boolean {
  return isBillableMail(kind) && itemNumberThisServiceYear > INCLUDED_REGULAR_MAIL_PER_YEAR;
}

/** Internal operator targets, in minutes after the document is available to Filewell. */
export const ESCALATION_TARGETS_MINUTES: Record<Urgency, { backup: number; owner: number } | null> = {
  urgent: { backup: 120, owner: 240 },
  high: { backup: 24 * 60, owner: 48 * 60 },
  normal: null,
};

export type EscalationLevel = "none" | "pending" | "backup_operator" | "owner";

/**
 * Where an unnotified document stands against the internal targets. Once the customer
 * has been notified (a delivered or acknowledged attempt), nothing escalates.
 */
export function escalationLevel(input: {
  kind: ServiceDocumentKind;
  availableAt: string;
  customerNotifiedAt: string | null;
  now: string;
}): EscalationLevel {
  if (input.customerNotifiedAt) return "none";
  const targets = ESCALATION_TARGETS_MINUTES[urgencyFor(input.kind)];
  if (!targets) return "none";
  const minutes = (Date.parse(input.now) - Date.parse(input.availableAt)) / 60_000;
  if (Number.isNaN(minutes)) return "pending";
  if (minutes >= targets.owner) return "owner";
  if (minutes >= targets.backup) return "backup_operator";
  return "pending";
}

/** Minutes between two timestamps, for the operator timing columns (null if either is missing). */
export function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const m = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  return Number.isNaN(m) ? null : m;
}
