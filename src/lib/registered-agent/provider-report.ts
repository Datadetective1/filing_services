import { findRule, isRuleSellable, realPaymentsPossible } from "@/lib/compliance/registry";
import type { EntityType } from "@/lib/domain/types";
import { getRaJurisdiction, RA_JURISDICTIONS } from "./jurisdictions";
import { PROVIDER_REPORT_FACTS, type ProviderReportFacts } from "./provider-report-facts";
import { BUNDLE_STATES, fulfillmentTested, nationwideBlockers, RA_ENTITY_TYPES, type SaleCheck } from "./sales";

/**
 * Annual reports in the states Filewell doesn't file itself. Registered Agents Inc. files them
 * at its wholesale rate (state fee plus $75); the customer pays the state fee plus Filewell's
 * service fee ($99, an approved service_prices row). An operator orders each one by hand in
 * the partner dashboard, like a formation, from /admin/registered-agent.
 *
 * Switches (all fail closed):
 *
 *   RAI_REPORT_SALES_<CODE>=true   open this state
 *   RAI_REPORT_SALES_ALL=true      open every state whose report fee is verified
 *
 * A state sells only an entity type whose report fee is one verified amount, with nothing
 * else (a tax, a license, a fee that rises with revenue or shares) owed with the report. The
 * ALL switch never opens a state with a missing fact. Where real money could be taken, the
 * nationwide gates (signed agreement, a company to contract with, a tested provider workflow)
 * must also pass, and checkout separately refuses an unapproved price.
 */

const flag = (name: string) => process.env[name]?.trim();

/** Where Filewell files the annual report itself: never sent to the provider. */
export const SELF_FILED_REPORT_STATES: readonly string[] = BUNDLE_STATES;

export function providerReportSwitchOn(code: string): boolean {
  return flag("RAI_REPORT_SALES_ALL") === "true" || flag(`RAI_REPORT_SALES_${code.toUpperCase()}`) === "true";
}

export function providerReportFacts(code: string): ProviderReportFacts | null {
  return PROVIDER_REPORT_FACTS[code.toUpperCase()] ?? null;
}

/** The state's verified report fee for this entity type, or null when it isn't one verified amount. */
export function providerReportFeeCents(code: string, entityType: EntityType): number | null {
  const f = providerReportFacts(code);
  if (!f || (entityType !== "llc" && entityType !== "corporation")) return null;
  const fee = f[entityType].feeCents;
  return typeof fee === "number" && Number.isInteger(fee) && fee >= 0 ? fee : null;
}

/** Whether Filewell files this state's report itself, so the customer belongs on the normal path. */
export function filewellFilesItself(code: string, entityType: EntityType): boolean {
  const c = code.toUpperCase();
  if (SELF_FILED_REPORT_STATES.includes(c)) return true;
  const rule = findRule(c, entityType, "annual_report", false);
  return Boolean(rule && isRuleSellable(rule));
}

/** Everything standing between this state and real-money provider annual reports. Empty means only the switch and an approved price remain. */
export function providerReportLiveBlockers(code: string, entityType: EntityType): string[] {
  const j = getRaJurisdiction(code);
  if (!j) return ["Unknown jurisdiction."];
  const out = nationwideBlockers();
  if (j.providerCoverage === "not_confirmed") out.push("The provider's coverage of this jurisdiction is not confirmed.");
  if (!fulfillmentTested(j)) out.push("No end-to-end test order with the provider yet.");
  if (!RA_ENTITY_TYPES.includes(entityType)) out.push("This entity type is not supported.");
  if (providerReportFeeCents(j.code, entityType) === null) out.push("Annual report fee not verified as one fixed amount for this entity type.");
  return out;
}

/** Whether an annual report filed through the provider can be bought here right now (in this environment). */
export function providerReportSaleCheck(code: string, entityType: EntityType): SaleCheck {
  const j = getRaJurisdiction(code);
  if (!j) return { ok: false, reason: "We don't file annual reports there." };
  if (filewellFilesItself(j.code, entityType)) return { ok: false, reason: `We file ${j.name} annual reports ourselves. Start from your business instead.` };
  if (!providerReportSwitchOn(j.code)) return { ok: false, reason: `Annual report filing isn't open in ${j.name} yet.` };
  if (!RA_ENTITY_TYPES.includes(entityType)) return { ok: false, reason: "We can only file for LLCs and corporations." };
  // A government fee is never guessed, in any environment.
  if (providerReportFeeCents(j.code, entityType) === null) return { ok: false, reason: `We haven't confirmed ${j.name}'s annual report fee for this type of business yet.` };
  if (realPaymentsPossible() && providerReportLiveBlockers(j.code, entityType).length > 0) {
    return { ok: false, reason: `Annual report filing isn't open in ${j.name} yet.` };
  }
  return { ok: true, reason: null };
}

export interface ProviderReportOpenState {
  code: string;
  name: string;
  slug: string;
  reportName: string;
  /** The verified state fee for each entity type open here; a missing type is not open. */
  feeCents: Partial<Record<"llc" | "corporation", number>>;
}

/** States where a provider-filed annual report can be ordered right now, with their verified fees. */
export function providerReportOpenStates(): ProviderReportOpenState[] {
  const out: ProviderReportOpenState[] = [];
  for (const j of RA_JURISDICTIONS) {
    const facts = providerReportFacts(j.code);
    if (!facts) continue;
    const feeCents: ProviderReportOpenState["feeCents"] = {};
    for (const t of ["llc", "corporation"] as const) {
      const fee = providerReportFeeCents(j.code, t);
      if (fee !== null && providerReportSaleCheck(j.code, t).ok) feeCents[t] = fee;
    }
    if (Object.keys(feeCents).length > 0) out.push({ code: j.code, name: j.name, slug: j.slug, reportName: facts.reportName, feeCents });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The one open state with this code, or null. */
export function providerReportOpenState(code: string): ProviderReportOpenState | null {
  return providerReportOpenStates().find((s) => s.code === code.toUpperCase()) ?? null;
}
