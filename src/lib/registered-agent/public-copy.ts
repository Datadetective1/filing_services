import { formatCents } from "@/lib/domain/money";
import type { RaJurisdiction } from "./jurisdictions";

/**
 * Public copy for the per-state registered agent pages, built from verified facts only. A fee
 * that is not verified for an entity type is left out, never guessed.
 */

function feeWord(cents: number): string {
  return cents === 0 ? "no state fee" : formatCents(cents, { trimZeros: true });
}

/** "$15 for an LLC or a corporation", "$25 for an LLC and $15 for a corporation", or null. */
export function changeFeeText(j: RaJurisdiction): string | null {
  const fees = j.changeOfAgent?.governmentFeeCents;
  if (!fees) return null;
  const llc = fees.llc;
  const corp = fees.corporation;
  if (typeof llc === "number" && typeof corp === "number") {
    return llc === corp ? `${feeWord(llc)} for an LLC or a corporation` : `${feeWord(llc)} for an LLC and ${feeWord(corp)} for a corporation`;
  }
  if (typeof llc === "number") return `${feeWord(llc)} for an LLC`;
  if (typeof corp === "number") return `${feeWord(corp)} for a corporation`;
  return null;
}

/** The state's fee to form a new LLC, where verified. */
export function formationLlcFeeText(j: RaJurisdiction): string | null {
  const fee = j.formation?.governmentFeeCents.llc;
  return typeof fee === "number" ? feeWord(fee) : null;
}

/** The latest date any change-of-agent source was checked. */
export function changeCheckedAt(j: RaJurisdiction): string | null {
  return [...new Set((j.changeOfAgent?.sources ?? []).map((s) => s.checkedAt))].sort().pop() ?? null;
}
