import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { compareISODate } from "@/lib/domain/dates";
import { currentFilingPeriod, nextFilingPeriod } from "@/lib/domain/deadlines";
import type { ISODate } from "@/lib/domain/types";

/**
 * The rule the homepage hero shows: of a state's verified rules with a fixed annual due
 * date, the one whose next due date (today included) is soonest. Ties keep registry
 * order, the order the homepage's deadline groups use, so the December 31 group shows
 * the limited partnership (the rule its "Other filing entities" link opens) and June 30
 * the business corporation. Only the rule and the date decide it.
 */
export function heroRule(rules: readonly ComplianceRuleDef[], today: ISODate): { rule: ComplianceRuleDef; dueDate: ISODate } | null {
  let best: { rule: ComplianceRuleDef; dueDate: ISODate } | null = null;
  for (const rule of rules) {
    if (rule.verificationStatus !== "verified" || rule.dueRule.kind !== "fixed_annual") continue;
    const current = currentFilingPeriod(rule, { today });
    const dueDate = compareISODate(current.dueDate, today) >= 0 ? current.dueDate : nextFilingPeriod(rule, current.periodYear)?.dueDate;
    if (dueDate && (!best || compareISODate(dueDate, best.dueDate) < 0)) best = { rule, dueDate };
  }
  return best;
}
