import type { ComplianceRuleDef, FaqItem, IntakeField, JurisdictionDef, RuleSource } from "@/lib/compliance/types";
import { dueRuleText, stateFeeText } from "@/lib/compliance/view";
import { formatMonthDay } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { ENTITY_COPY, joinList } from "./entities";

/**
 * Builders that turn verified registry rules into page content. They only reshape
 * facts that already exist in the registry; they never add new ones.
 */

// En dash (U+2013) and em dash (U+2014), with any surrounding spaces.
const LONG_DASH = new RegExp(`\\s*[${String.fromCharCode(0x2013, 0x2014)}]\\s*`, "g");

/** Visible copy never uses long dashes. Normalizes quoted text (typography only). */
export function plainDashes(text: string): string {
  return text.replace(LONG_DASH, " - ");
}

/** "Pennsylvania Department of State" from "Pennsylvania Department of State - Bureau of ...". */
export function agencyShortName(j: JurisdictionDef): string {
  return j.agency.name.split(" - ")[0];
}

/** "January 1 to September 30" for fixed annual deadlines, else null. */
export function filingWindowText(rule: ComplianceRuleDef): string | null {
  if (rule.dueRule.kind !== "fixed_annual") return null;
  return `January 1 to ${formatMonthDay(rule.dueRule.month, rule.dueRule.day)}`;
}

/** "September 30" for fixed annual deadlines, else the generic due text. */
export function dueDayText(rule: ComplianceRuleDef): string {
  return rule.dueRule.kind === "fixed_annual" ? formatMonthDay(rule.dueRule.month, rule.dueRule.day) : dueRuleText(rule.dueRule);
}

type PeopleField = Extract<IntakeField, { type: "people" }>;

function peopleField(rule: ComplianceRuleDef, key: string): PeopleField | null {
  for (const section of rule.intake.sections) {
    for (const field of section.fields) {
      if (field.key === key && field.type === "people") return field;
    }
  }
  return null;
}

/** Who counts as a "governor" for this entity type, from the rule's intake schema. */
export function governorInfo(rule: ComplianceRuleDef) {
  const governors = peopleField(rule, "governors");
  const officers = peopleField(rule, "principal_officers");
  return {
    label: governors?.label ?? "Governors",
    help: governors?.help ?? null,
    titles: governors?.titleSuggestions ?? [],
    officersRequired: Boolean(officers?.required),
    officerHelp: officers?.help ?? null,
    officerTitles: officers?.titleSuggestions ?? [],
  };
}

/** The rule's required-information list with the governor line phrased cleanly. */
export function requiredInfoForRule(rule: ComplianceRuleDef): string[] {
  const g = governorInfo(rule);
  return rule.requiredInformation.map((item) =>
    item.startsWith("At least one ") ? `The name of at least one governor (${g.label.toLowerCase()})` : item,
  );
}

/** Items every rule in a state shares, plus state-level governor and officer lines. */
export function commonRequiredInfo(rules: ComplianceRuleDef[]): string[] {
  if (!rules.length) return [];
  const shared = rules[0].requiredInformation.filter((item) =>
    rules.every((r) => r.requiredInformation.includes(item)),
  );
  const seen = new Set<string>();
  const governorExamples: string[] = [];
  for (const r of rules) {
    const label = governorInfo(r).label.toLowerCase();
    if (seen.has(label) || governorExamples.length >= 4) continue;
    seen.add(label);
    governorExamples.push(`${label} for ${ENTITY_COPY[r.entityType].plural}`);
  }
  const officerTypes = rules.filter((r) => governorInfo(r).officersRequired).map((r) => ENTITY_COPY[r.entityType].plural);
  const out = [...shared];
  out.splice(
    Math.min(3, out.length),
    0,
    `The name of at least one governor. Who that is depends on the entity type, for example ${joinList(governorExamples)}.`,
    officerTypes.length
      ? `Names and titles of principal officers, if any. ${capitalize(joinList(officerTypes))} list their principal officers.`
      : "Names and titles of principal officers, if any.",
  );
  return out;
}

export interface DueRow {
  rule: ComplianceRuleDef;
  label: string;
  due: string;
  window: string | null;
  fee: string;
}

export function dueTableRows(rules: ComplianceRuleDef[]): DueRow[] {
  return rules.map((rule) => ({
    rule,
    label: ENTITY_TYPE_LABELS[rule.entityType],
    due: dueRuleText(rule.dueRule),
    window: filingWindowText(rule),
    fee: stateFeeText(rule),
  }));
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function dueSortKey(rule: ComplianceRuleDef): number {
  return rule.dueRule.kind === "fixed_annual" ? rule.dueRule.month * 100 + rule.dueRule.day : 9999;
}

/** Rules ordered by due date within the year. */
export function sortByDue(rules: ComplianceRuleDef[]): ComplianceRuleDef[] {
  return [...rules].sort((a, b) => dueSortKey(a) - dueSortKey(b));
}

/**
 * "business corporations and nonprofit corporations by June 30, LLCs by September 30,
 * and other filing entities by December 31"
 */
export function dueSummary(rules: ComplianceRuleDef[]): string {
  const groups = new Map<string, ComplianceRuleDef[]>();
  for (const r of sortByDue(rules)) {
    const key = dueDayText(r);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const entries = [...groups.entries()];
  const parts = entries.map(([day, group], i) => {
    const who =
      i === entries.length - 1 && entries.length > 1 && group.length >= 3
        ? "other filing entities"
        : joinList(group.map((r) => ENTITY_COPY[r.entityType].plural));
    return `${who} by ${day}`;
  });
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** "$7, with no fee for nonprofit corporations or for LLCs and limited partnerships with a not-for-profit purpose" */
export function feeSummary(rules: ComplianceRuleDef[]): string {
  const amounts = [...new Set(rules.filter((r) => r.stateFeeCents > 0).map((r) => r.stateFeeCents))].sort((a, b) => a - b);
  const free = rules.filter((r) => r.stateFeeCents === 0).map((r) => ENTITY_COPY[r.entityType].plural);
  const npFree = rules
    .filter((r) => r.stateFeeCents > 0 && r.nonprofitStateFeeCents === 0)
    .map((r) => ENTITY_COPY[r.entityType].plural);
  const base = amounts.length
    ? amounts.length === 1
      ? formatCents(amounts[0], { trimZeros: true })
      : `${formatCents(amounts[0], { trimZeros: true })} to ${formatCents(amounts[amounts.length - 1], { trimZeros: true })}`
    : "no state fee";
  const exceptions = [
    free.length ? joinList(free) : null,
    npFree.length ? `${joinList(npFree)} with a not-for-profit purpose` : null,
  ].filter(Boolean) as string[];
  return amounts.length && exceptions.length ? `${base}, with no fee for ${exceptions.join(" or for ")}` : base;
}

/** State-level FAQ built from the rules: generated due-date and fee answers plus shared questions. */
export function stateFaq(rules: ComplianceRuleDef[], stateName: string, agency: string): FaqItem[] {
  if (!rules.length) return [];
  const items: FaqItem[] = [];

  // Due dates, grouped by date.
  const byDue = new Map<string, ComplianceRuleDef[]>();
  for (const r of sortByDue(rules)) {
    const key = dueDayText(r);
    byDue.set(key, [...(byDue.get(key) ?? []), r]);
  }
  const dueSentences = [...byDue.entries()].map(
    ([day, group]) => `${capitalize(joinList(group.map((r) => ENTITY_COPY[r.entityType].plural)))}: by ${day}.`,
  );
  items.push({
    q: `When is the ${stateName} annual report due?`,
    a: `It depends on the entity type. Based on the ${agency}'s published requirements: ${dueSentences.join(" ")} The filing window opens January 1 of the report year.`,
  });

  // State fees, grouped by amount.
  const byFee = new Map<number, ComplianceRuleDef[]>();
  for (const r of rules) {
    if (r.stateFeeCents > 0) byFee.set(r.stateFeeCents, [...(byFee.get(r.stateFeeCents) ?? []), r]);
  }
  const free = rules.filter((r) => r.stateFeeCents === 0).map((r) => ENTITY_COPY[r.entityType].plural);
  const npFree = rules
    .filter((r) => r.stateFeeCents > 0 && r.nonprofitStateFeeCents === 0)
    .map((r) => ENTITY_COPY[r.entityType].plural);
  const feeParts = [...byFee.entries()].map(
    ([cents, group]) => `${formatCents(cents, { trimZeros: true })} for ${joinList(group.map((r) => ENTITY_COPY[r.entityType].plural))}`,
  );
  let feeAnswer = `The ${agency} charges ${joinList(feeParts)}.`;
  if (free.length || npFree.length) {
    const freeText = [
      free.length ? joinList(free) : null,
      npFree.length ? `${joinList(npFree)} with a not-for-profit purpose` : null,
    ].filter(Boolean) as string[];
    feeAnswer += ` There is no state fee for ${freeText.join(", or for ")}.`;
  }
  feeAnswer += " If you have us file it, our service fee is shown separately before you pay.";
  items.push({ q: "How much does it cost to file?", a: feeAnswer });

  // Questions every rule shares with the identical answer.
  for (const item of rules[0].faq) {
    const shared = rules.every((r) => r.faq.some((f) => f.q === item.q && f.a === item.a));
    if (shared) items.push(item);
  }
  return items;
}

export interface SourceGroup {
  url: string;
  title: string;
  publisher: string;
  lastVerifiedAt: string;
  quotes: string[];
}

/** One entry per distinct official URL, with every distinct quote taken from it. */
export function groupSources(sources: RuleSource[]): SourceGroup[] {
  const map = new Map<string, SourceGroup>();
  for (const s of sources) {
    const existing = map.get(s.url);
    if (existing) {
      if (!existing.quotes.includes(s.quote)) existing.quotes.push(s.quote);
      if (s.lastVerifiedAt > existing.lastVerifiedAt) existing.lastVerifiedAt = s.lastVerifiedAt;
    } else {
      map.set(s.url, { url: s.url, title: s.title, publisher: s.publisher, lastVerifiedAt: s.lastVerifiedAt, quotes: [s.quote] });
    }
  }
  return [...map.values()];
}

/** Latest verification date across rules (ISO). */
export function latestVerified(rules: ComplianceRuleDef[]): string | null {
  return rules.reduce<string | null>((max, r) => (!max || r.lastVerifiedAt > max ? r.lastVerifiedAt : max), null);
}
