import { findRule, getJurisdiction } from "@/lib/compliance/registry";
import type { ComplianceRuleDef, DueRule, FirstDueRule } from "@/lib/compliance/types";
import type { EntityType } from "@/lib/domain/types";
import { PROVIDER_REPORT_FACTS } from "@/lib/registered-agent/provider-report-facts";
import { STATE_DUE_RULES } from "./state-due-rules";

/**
 * The rule a free reminder is computed from: the verified compliance rule where we have one,
 * otherwise the due rule restated from the provider research (see ./state-due-rules.ts) for
 * the entity types that state requires a report from. Pure (no I/O).
 */
export interface ReminderRule {
  stateCode: string;
  entityType: EntityType;
  filingName: string;
  dueRule: DueRule;
  firstDueRule: FirstDueRule;
  firstRequiredYear?: number;
  /** The verified compliance rule, when that is the source (fees and our service come from it). */
  verified: ComplianceRuleDef | null;
}

const PROVIDER_TYPES = ["llc", "corporation"] as const;

export function reminderRuleFor(stateCode: string, entityType: EntityType, isForeign = false): ReminderRule | null {
  const code = stateCode.toUpperCase();
  const rule = findRule(code, entityType, "annual_report", isForeign);
  if (rule && rule.verificationStatus === "verified") {
    return {
      stateCode: code,
      entityType,
      filingName: rule.filingName,
      dueRule: rule.dueRule,
      firstDueRule: rule.firstDueRule,
      firstRequiredYear: rule.firstRequiredYear,
      verified: rule,
    };
  }
  const due = STATE_DUE_RULES[code];
  const facts = PROVIDER_REPORT_FACTS[code];
  if (!due || !facts || !(PROVIDER_TYPES as readonly string[]).includes(entityType)) return null;
  if (facts[entityType as (typeof PROVIDER_TYPES)[number]].required !== true) return null;
  return { stateCode: code, entityType, filingName: facts.reportName, dueRule: due.dueRule, firstDueRule: due.firstDueRule, verified: null };
}

/** The reminder rules a state offers, one per entity type it can remind about. */
export function reminderRulesForState(stateCode: string): ReminderRule[] {
  const j = getJurisdiction(stateCode);
  if (!j) return [];
  const out: ReminderRule[] = [];
  for (const t of ["llc", "corporation", "nonprofit_corporation", "lp", "llp", "electing_partnership", "professional_association", "business_trust"] as const) {
    const r = reminderRuleFor(j.code, t);
    if (r) out.push(r);
  }
  return out;
}
