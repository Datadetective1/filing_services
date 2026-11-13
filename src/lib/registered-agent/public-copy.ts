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

/** Places that are not states: shown by name after the state count. */
const NOT_STATES: Record<string, string> = { DC: "DC", PR: "Puerto Rico" };

/** How many of the 50 states are in a list of jurisdiction codes. */
export function stateCount(codes: string[]): number {
  return codes.filter((c) => !(c.toUpperCase() in NOT_STATES)).length;
}

/** "all 50 states and DC", "42 states, DC and Puerto Rico", "Texas" (one place, by name). */
export function placesText(places: { code: string; name: string }[]): string {
  if (places.length === 1) return places[0].name;
  const n = stateCount(places.map((p) => p.code));
  const extras = places.map((p) => NOT_STATES[p.code.toUpperCase()]).filter((x): x is string => Boolean(x));
  const parts = [n === 50 ? "all 50 states" : `${n} ${n === 1 ? "state" : "states"}`, ...extras];
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
