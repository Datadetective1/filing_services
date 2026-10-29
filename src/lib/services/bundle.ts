/**
 * Registered agent + annual report bundle: which annual report each bundle year includes.
 *
 * The subscription's billing anniversary and the state's annual report due date are two
 * separate things and are modelled separately:
 *
 *   bundle period      [periodStart, periodEnd), one year, set by billing
 *   reporting year     the state's own report year (a filing_requirements row)
 *
 * RULE: a bundle period includes exactly one annual report, the business's earliest
 * report whose state due date falls on or after the period's start and before its end,
 * and which is still open (not already filed with us, filed elsewhere, not required or
 * cancelled). A period with no such report includes none, and the bundle is not sold
 * for a first period like that (the customer buys registered agent service alone).
 *
 * The state's annual report fee is never charged on the billing anniversary. It is
 * charged only when the customer authorizes that reporting year's filing, through the
 * existing annual report checkout, with Filewell's service fee for it set to $0 because the
 * bundle already paid for it. A reporting year can be included in at most one bundle
 * period, and a requirement can have only one active filing (database unique indexes),
 * so the same report is never filed twice.
 */

export interface RequirementLike {
  id: string;
  periodYear: number;
  dueDate: string; // YYYY-MM-DD
  status: "open" | "filed_with_us" | "filed_elsewhere" | "not_required" | "cancelled";
}

export interface BundlePeriod {
  start: string; // YYYY-MM-DD (inclusive)
  end: string; // YYYY-MM-DD (exclusive)
}

export function includedRequirement(period: BundlePeriod, requirements: RequirementLike[]): RequirementLike | null {
  if (!(period.start < period.end)) throw new Error("Invalid bundle period");
  const candidates = requirements
    .filter((r) => r.status === "open" && r.dueDate >= period.start && r.dueDate < period.end)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  return candidates[0] ?? null;
}

/** One year after `start` (Feb 29 rolls to Mar 1, like Stripe's yearly anniversary). */
export function addOneYear(start: string): string {
  const [y, m, d] = start.split("-").map(Number);
  const date = new Date(Date.UTC(y + 1, m - 1, d));
  return date.toISOString().slice(0, 10);
}

export const STATE_FEE_COLLECTION_STATUSES = ["not_due", "awaiting_authorization", "checkout_open", "collected", "not_applicable"] as const;
export type StateFeeCollectionStatus = (typeof STATE_FEE_COLLECTION_STATUSES)[number];

export const BUNDLE_FILING_STATUSES = ["scheduled", "awaiting_authorization", "authorized", "filing_in_progress", "filed", "not_included", "superseded"] as const;
export type BundleFilingStatus = (typeof BUNDLE_FILING_STATUSES)[number];

/**
 * Whether the customer should be asked to authorize this bundle year's filing now. We ask
 * once the state accepts filings for that report year (the rule's filing window), never
 * before, and never by charging anything automatically.
 */
export function shouldRequestAuthorization(input: {
  today: string;
  dueDate: string;
  /** Days before the due date the state accepts filings (rule.filingWindowDaysBefore), null = any time in the report year. */
  filingWindowDaysBefore: number | null;
  reportingYear: number;
  status: BundleFilingStatus;
}): boolean {
  if (input.status !== "scheduled") return false;
  if (input.today > input.dueDate) return true; // Late: still ask (the customer decides; late fees are the state's).
  if (input.filingWindowDaysBefore !== null) {
    const due = Date.parse(`${input.dueDate}T00:00:00Z`);
    const opens = new Date(due - input.filingWindowDaysBefore * 86_400_000).toISOString().slice(0, 10);
    return input.today >= opens;
  }
  return input.today >= `${input.reportingYear}-01-01`;
}
