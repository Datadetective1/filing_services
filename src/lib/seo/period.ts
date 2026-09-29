import "server-only";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import { periodFor } from "@/lib/filings/customer";

/**
 * The period to show a general visitor on a public page. We don't know their
 * business, so once this year's deadline has passed we show next year's report and
 * mention the missed one separately (calmly, as a fact) instead of a "past due"
 * counter aimed at everyone.
 */
export function marketingPeriod(
  rule: ComplianceRuleDef,
  now: Date = new Date(),
): { period: FilingPeriod; missed: FilingPeriod | null } {
  const current = periodFor(rule, { formationDate: null, alreadyFiledThisYear: false }, now);
  if (current.phase !== "overdue") return { period: current, missed: null };
  const next = periodFor(rule, { formationDate: null, alreadyFiledThisYear: true }, now);
  return { period: next, missed: current };
}
