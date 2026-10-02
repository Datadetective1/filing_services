import "server-only";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { businessNow } from "@/lib/domain/clock";
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
  now: Date = businessNow(),
): { period: FilingPeriod | null; missed: FilingPeriod | null } {
  // Anniversary-based due dates depend on the business's formation month: there's no
  // single "current period" to show a general visitor.
  if (rule.dueRule.kind !== "fixed_annual") return { period: null, missed: null };
  const current = periodFor(rule, { formationDate: null, alreadyFiledThisYear: false }, now);
  if (current.phase !== "overdue") return { period: current, missed: null };
  const next = periodFor(rule, { formationDate: null, alreadyFiledThisYear: true }, now);
  return { period: next, missed: current };
}
