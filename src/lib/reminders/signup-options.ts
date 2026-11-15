import { getJurisdiction } from "@/lib/compliance/registry";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/lib/domain/types";
import { reminderConsentText } from "./consent";
import { type ReminderRule, reminderRulesForState } from "./rules";

/**
 * What the "remind me before my deadline" box on a state's pages asks for. Only states
 * where we can compute the due date ourselves (see ./rules.ts) get the box. Pure (no I/O).
 */

export interface ReminderEntityOption {
  value: EntityType;
  label: string;
  /**
   * The due date follows the month the business formed (anniversary states), so the box
   * asks for that month and year. Fixed-date states don't ask.
   */
  needsFormation: boolean;
}

export interface ReminderSignupOptions {
  stateCode: string;
  stateName: string;
  filingName: string;
  entities: ReminderEntityOption[];
  consentText: string;
}

/** Rules the box can remind about: due on a date we can compute from a month. */
export function reminderRules(stateCode: string): ReminderRule[] {
  return reminderRulesForState(stateCode).filter((r) => r.dueRule.kind !== "anniversary_date");
}

export function reminderSignupOptions(stateCode: string, only?: EntityType): ReminderSignupOptions | null {
  const j = getJurisdiction(stateCode);
  if (!j) return null;
  const rules = reminderRules(j.code).filter((r) => !only || r.entityType === only);
  if (!rules.length) return null;
  const entities: ReminderEntityOption[] = rules.map((r) => ({
    value: r.entityType,
    label: ENTITY_TYPE_LABELS[r.entityType],
    needsFormation: r.dueRule.kind !== "fixed_annual",
  }));
  // LLCs are the most common filer, so they come first (the default choice).
  entities.sort((a, b) => Number(b.value === "llc") - Number(a.value === "llc"));
  const filingName = rules[0].filingName;
  return { stateCode: j.code, stateName: j.name, filingName, entities, consentText: reminderConsentText(j.name, filingName) };
}

/** The page a sign-up came from, as stored with analytics: a plain site path or nothing. */
export function cleanSignupPage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.split(/[?#]/)[0];
  return /^\/[a-z0-9/-]{0,150}$/.test(p) ? p : null;
}

/**
 * The formation month a visitor picked, as the first of that month. Null when not given,
 * not a real month, or in the future.
 */
export function formationFromMonth(month: unknown, year: unknown, today: string): string | null {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || !Number.isInteger(y) || m < 1 || m > 12 || y < 1800) return null;
  const iso = `${y}-${String(m).padStart(2, "0")}-01`;
  return iso <= today ? iso : null;
}
