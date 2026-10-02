import { evaluateGovernmentFees, type GovFeeEvaluation, type StateStatus } from "@/lib/domain/government-fees";
import type { GovernmentLine } from "@/lib/domain/pricing";
import type { ISODate } from "@/lib/domain/types";
import type { GovFeeComponent, LateFeeRule } from "./types";

/**
 * Bridge between a rule (code registry or a filing's frozen rule_snapshot) and the
 * government fee engine. Pure.
 */

export interface FeeSource {
  stateFeeCents: number;
  nonprofitStateFeeCents?: number | null;
  feeComponents?: GovFeeComponent[] | null;
  lateFees?: LateFeeRule[] | null;
}

/** Read the fee fields from a state_rule_versions row / filing.rule_snapshot. */
export function feeSourceFromSnapshot(snapshot: Record<string, unknown>): FeeSource {
  return {
    stateFeeCents: Number(snapshot.state_fee_cents ?? 0),
    nonprofitStateFeeCents: (snapshot.nonprofit_state_fee_cents as number | null | undefined) ?? null,
    feeComponents: (snapshot.fee_components as GovFeeComponent[] | null | undefined) ?? null,
    lateFees: (snapshot.late_fees as LateFeeRule[] | null | undefined) ?? null,
  };
}

export function evaluateFees(
  source: FeeSource,
  ctx: { isNonprofit: boolean; dueDate: ISODate | null; filingDate: ISODate; status: StateStatus | null; filingThisPeriod?: boolean },
): GovFeeEvaluation {
  return evaluateGovernmentFees(
    {
      stateFeeCents: source.stateFeeCents,
      nonprofitStateFeeCents: source.nonprofitStateFeeCents,
      feeComponents: source.feeComponents ?? undefined,
      lateFees: source.lateFees ?? undefined,
    },
    ctx,
  );
}

/**
 * Government lines for a quote. Returns undefined when the charge is a single plain
 * filing fee, so existing (Pennsylvania) quotes keep their exact wording.
 */
export function quoteGovernmentLines(evaluation: GovFeeEvaluation): { totalCents: number; lines: GovernmentLine[] | undefined } {
  const lines: GovernmentLine[] = evaluation.due.map((l) => ({ kind: l.kind, label: l.label, cents: l.cents }));
  const plain = lines.length === 1 && lines[0].kind === "government_fee";
  return { totalCents: evaluation.totalCents, lines: plain ? undefined : lines };
}
