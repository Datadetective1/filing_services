import { RULES } from "./registry";

/** True when any verified rule in the state sets its due date from the formation date. */
export function formationDateRequired(stateCode: string): boolean {
  return RULES.some((r) => r.stateCode === stateCode && r.verificationStatus === "verified" && r.dueRule.kind !== "fixed_annual");
}
