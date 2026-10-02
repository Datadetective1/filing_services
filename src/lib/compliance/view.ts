import { formatMonthDay } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import type { ComplianceRuleDef, DueRule } from "./types";

/** Human text for a due rule, e.g. "September 30 each year". */
export function dueRuleText(rule: DueRule): string {
  switch (rule.kind) {
    case "fixed_annual":
      return `${formatMonthDay(rule.month, rule.day)} each year`;
    case "anniversary_month_end":
      return rule.intervalYears === 2
        ? "End of your formation anniversary month, every two years"
        : "End of your formation anniversary month each year";
    case "anniversary_date":
      return rule.intervalYears === 2 ? "Your formation anniversary, every two years" : "Your formation anniversary each year";
  }
}

export function stateFeeText(rule: Pick<ComplianceRuleDef, "stateFeeCents" | "nonprofitStateFeeCents"> & Partial<Pick<ComplianceRuleDef, "feeComponents">>): string {
  if (rule.feeComponents && rule.feeComponents.length > 1) {
    return `${rule.feeComponents.map((c) => `${formatCents(c.cents, { trimZeros: true })} ${c.label}`).join(" + ")} (${formatCents(rule.stateFeeCents, { trimZeros: true })} total)`;
  }
  if (rule.stateFeeCents === 0) return "No state fee";
  const base = formatCents(rule.stateFeeCents, { trimZeros: true });
  if (rule.nonprofitStateFeeCents === 0) return `${base} (no fee with a not-for-profit purpose)`;
  return base;
}

export function lateFeeText(rule: Pick<ComplianceRuleDef, "lateFeeCents" | "lateFeeSummary">): string {
  return rule.lateFeeCents === null ? rule.lateFeeSummary : `${formatCents(rule.lateFeeCents)}. ${rule.lateFeeSummary}`;
}

/** e.g. "Verified Sep 27, 2026" */
export function verifiedText(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
