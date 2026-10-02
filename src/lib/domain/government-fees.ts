import type { GovFeeComponent, LateFeeRule } from "@/lib/compliance/types";
import { compareISODate, addDays } from "./dates";
import type { ISODate } from "./types";

/**
 * Government fee engine (pure). Turns a verified rule's fee components and late-fee rules
 * into itemized lines for one filing, never folding anything into Filewell's fee.
 *
 * Late charges:
 *  - "state_status" charges apply ONLY when the state's own record (fetched from an
 *    official source, with a timestamp) shows a matching status. Unknown status means
 *    "unknown", never "applies": a passed date is not evidence of a state status.
 *  - "filed_after_due_date" charges apply when the official rule itself is date-based and
 *    the filing would be submitted after the due date (+ grace).
 */

export interface StateStatus {
  /** Status exactly as the state shows it, e.g. "Active", "Delinquent". */
  value: string;
  source: string;
  checkedAt: string;
}

export type LateApplicability = "applies" | "does_not_apply" | "unknown";

export interface GovFeeLine {
  key: string;
  label: string;
  cents: number;
  kind: "government_fee" | "government_late_fee";
  applicability: LateApplicability;
  reason: string;
  sourceFactKey: string;
  /** For status-based charges: the state statuses that trigger it. */
  requiresStatus?: string[];
  /** For date-based charges that may already apply: the due date that passed. */
  dueBy?: ISODate;
}

export interface GovFeeEvaluation {
  /** Lines that are due now: base components plus late charges that verifiably apply. */
  due: GovFeeLine[];
  /** Late charges that might apply but can't be confirmed (status unknown). Not charged. */
  possible: GovFeeLine[];
  /** Late charges that verifiably don't apply now (shown as "file by X to avoid Y" when date-based). */
  avoidable: { line: GovFeeLine; fileBy: ISODate | null }[];
  totalCents: number;
}

export interface FeeRuleInput {
  stateFeeCents: number;
  nonprofitStateFeeCents?: number | null;
  feeComponents?: GovFeeComponent[];
  lateFees?: LateFeeRule[];
}

export function baseComponents(rule: FeeRuleInput, isNonprofit: boolean): GovFeeLine[] {
  const comps: GovFeeComponent[] = rule.feeComponents?.length
    ? rule.feeComponents
    : [{ key: "filing_fee", label: "State filing fee", cents: rule.stateFeeCents, nonprofitCents: rule.nonprofitStateFeeCents ?? null, sourceFactKey: "state_fee" }];
  return comps
    .map((c) => ({
      key: c.key,
      label: c.label,
      cents: isNonprofit && c.nonprofitCents !== null && c.nonprofitCents !== undefined ? c.nonprofitCents : c.cents,
      kind: "government_fee" as const,
      applicability: "applies" as const,
      reason: "Due with every filing",
      sourceFactKey: c.sourceFactKey,
    }))
    .filter((l) => l.cents > 0 || comps.length === 1);
}

export function evaluateGovernmentFees(
  rule: FeeRuleInput,
  ctx: {
    isNonprofit: boolean;
    dueDate: ISODate | null;
    filingDate: ISODate;
    status: StateStatus | null;
    /**
     * True when this period is actually being filed now (checkout). On an informational page
     * we don't know whether the period was already filed, so a passed date only makes a
     * date-based charge "possible".
     */
    filingThisPeriod?: boolean;
  },
): GovFeeEvaluation {
  const due = baseComponents(rule, ctx.isNonprofit);
  const possible: GovFeeLine[] = [];
  const avoidable: { line: GovFeeLine; fileBy: ISODate | null }[] = [];

  for (const lf of rule.lateFees ?? []) {
    const base = { key: lf.key, label: lf.label, cents: lf.cents, kind: "government_late_fee" as const, sourceFactKey: lf.sourceFactKey };
    if (lf.exemptNonprofit && ctx.isNonprofit) {
      avoidable.push({ line: { ...base, applicability: "does_not_apply", reason: "Not charged to not-for-profit entities" }, fileBy: null });
      continue;
    }
    if (lf.trigger.kind === "state_status") {
      const statuses = lf.trigger.statuses.map((s) => s.toLowerCase());
      if (!ctx.status) {
        possible.push({
          ...base,
          applicability: "unknown",
          requiresStatus: lf.trigger.statuses,
          reason: `Applies only if the state's record shows ${lf.trigger.statuses.join(" or ")}; current status not confirmed`,
        });
      } else if (statuses.includes(ctx.status.value.trim().toLowerCase())) {
        due.push({ ...base, applicability: "applies", reason: `The state's record shows "${ctx.status.value}" (checked ${ctx.status.checkedAt.slice(0, 10)})` });
      } else {
        avoidable.push({ line: { ...base, applicability: "does_not_apply", reason: `The state's record shows "${ctx.status.value}"` }, fileBy: null });
      }
      continue;
    }
    // filed_after_due_date
    if (!ctx.dueDate) {
      possible.push({ ...base, applicability: "unknown", reason: "Due date not known" });
      continue;
    }
    const lastOnTime = addDays(ctx.dueDate, lf.trigger.graceDays ?? 0);
    if (compareISODate(ctx.filingDate, lastOnTime) > 0) {
      if (ctx.filingThisPeriod === false) {
        possible.push({ ...base, applicability: "unknown", reason: `Applies if the report due ${lastOnTime} wasn't filed on time`, dueBy: lastOnTime });
      } else {
        due.push({ ...base, applicability: "applies", reason: `Filed after ${lastOnTime}` });
      }
    } else {
      avoidable.push({ line: { ...base, applicability: "does_not_apply", reason: `On time if filed by ${lastOnTime}` }, fileBy: lastOnTime });
    }
  }

  return { due, possible, avoidable, totalCents: due.reduce((n, l) => n + l.cents, 0) };
}
