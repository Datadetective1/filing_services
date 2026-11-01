import { isProductionEnvironment } from "@/config/site";
import { findRule, isSellableForBusiness, realPaymentsPossible } from "@/lib/compliance/registry";
import type { EntityType } from "@/lib/domain/types";
import { changeOfAgentFeeCents, formationFeeCents, getRaJurisdiction, stateSpecificBlockers } from "./jurisdictions";

/**
 * Sales switches for business services. Every one fails closed.
 *
 *   RA_PROVIDER_AGREEMENT_SIGNED=true   the wholesale Service Agreement is signed (owner sets it)
 *   RA_FULFILLMENT_TESTED=true          one end-to-end test order with the provider succeeded
 *   RA_SALES_<CODE>=true                registered agent checkout open in that jurisdiction
 *   RA_SALES_ALL=true                   open it in every jurisdiction whose facts are verified
 *   RA_BUNDLE_SALES=true                the registered agent + annual report bundle may be sold
 *   FORMATION_SALES_<CODE>=true         formation checkout open in that jurisdiction
 *   FORMATION_SALES_ALL=true            open formation in every state whose fee is verified
 *   BUSINESS_SERVICES_PAGES=true        public registered agent / formation pages on production
 *   RA_ALERTS_MAILBOX=<address>         Filewell's own alerts mailbox, added as a second notification email on the provider account
 *
 * Real-money sales also need NEXT_PUBLIC_LEGAL_ENTITY set to a company (Harborlune LLC once
 * formed). Customers never contract with a person.
 *
 * The "ALL" switches never open a jurisdiction with a missing fact: every check below still
 * runs per jurisdiction, entity type and path.
 *
 * A switch alone never opens real-money sales: where real money could be taken (production
 * or live keys) every jurisdiction blocker must also be cleared, and checkout separately
 * refuses any service price an admin has not approved. A sandbox or Stripe test deployment
 * may run the journeys with only the switch, so the flows can be tested end to end, but
 * even there a government fee is never guessed: an unverified fee blocks the quote.
 */

const flag = (name: string) => process.env[name]?.trim();

export type RaSituation =
  /** The business exists and names another agent today: the state must be told (change filing). */
  | "switching"
  /** The business is being formed by the customer elsewhere and will name us in its formation filing. */
  | "new_entity";

/** Entity types the registered agent service is built for. */
export const RA_ENTITY_TYPES: EntityType[] = ["llc", "corporation"];

/** Annual-report states where Filewell files itself: the only places a bundle can exist. */
export const BUNDLE_STATES = ["PA", "CO", "FL", "SD", "MT", "MI"] as const;

export function providerAgreementSigned(): boolean {
  return flag("RA_PROVIDER_AGREEMENT_SIGNED") === "true";
}

export function raSwitchOn(code: string): boolean {
  return flag("RA_SALES_ALL") === "true" || flag(`RA_SALES_${code.toUpperCase()}`) === "true";
}

export function formationSwitchOn(code: string): boolean {
  return flag("FORMATION_SALES_ALL") === "true" || flag(`FORMATION_SALES_${code.toUpperCase()}`) === "true";
}

/**
 * The provider workflow is the same in every jurisdiction (only the facts differ), so one
 * successful end-to-end test order proves it everywhere. A jurisdiction can still be marked
 * ready on its own.
 */
export function fulfillmentTested(j: { fulfillmentReady: boolean }): boolean {
  return j.fulfillmentReady || flag("RA_FULFILLMENT_TESTED") === "true";
}

/** Public business-services pages: always on outside production, on production only by switch. */
export function businessServicesPagesEnabled(): boolean {
  return !isProductionEnvironment() || flag("BUSINESS_SERVICES_PAGES") === "true";
}

/** Search engines may index the business-services pages only once they are launched on production. */
export function businessServicesIndexable(): boolean {
  return isProductionEnvironment() && flag("BUSINESS_SERVICES_PAGES") === "true";
}

/** A company name (LLC, Inc., Corporation and the like), never a person's name. */
const COMPANY_NAME = /\b(LLC|L\.L\.C\.|Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.|Ltd\.?|PLLC|LLP)$/i;

/** The company customers contract with is set, and it is a company. */
export function contractingCompanyConfigured(): boolean {
  const name = process.env.NEXT_PUBLIC_LEGAL_ENTITY?.trim() ?? "";
  return COMPANY_NAME.test(name);
}

/**
 * Gates that apply everywhere, before any jurisdiction: the provider contract, a company to
 * contract with and a second alerts mailbox.
 */
export function nationwideBlockers(): string[] {
  const out: string[] = [];
  if (!providerAgreementSigned()) out.push("Wholesale Service Agreement not signed.");
  if (!contractingCompanyConfigured()) out.push("The contracting company (NEXT_PUBLIC_LEGAL_ENTITY) is not set to a company such as Harborlune LLC.");
  if (!flag("RA_ALERTS_MAILBOX")) out.push("No Filewell alerts mailbox on the provider account (RA_ALERTS_MAILBOX).");
  return out;
}

/**
 * Everything standing between this jurisdiction and real-money registered agent sales, in
 * plain words. Empty means only the switch and an approved price remain.
 */
export function raLiveBlockers(code: string, entityType: EntityType, situation: RaSituation): string[] {
  const j = getRaJurisdiction(code);
  if (!j) return ["Unknown jurisdiction."];
  const out: string[] = nationwideBlockers();
  if (j.providerCoverage === "not_confirmed") out.push("The provider's coverage of this jurisdiction is not confirmed.");
  if (!fulfillmentTested(j)) out.push("No end-to-end test order with the provider yet.");
  if (!RA_ENTITY_TYPES.includes(entityType)) out.push("This entity type is not supported.");
  if (situation === "switching" && changeOfAgentFeeCents(code, entityType) === null) out.push("Change of agent fee not verified for this entity type.");
  if (situation === "new_entity" && !j.appointmentProcess) out.push("How a new entity names the agent here is not verified.");
  for (const b of stateSpecificBlockers(j)) if (!out.includes(b)) out.push(b);
  return out;
}

/** Everything standing between this state and real-money formation sales. Empty means only the switch and an approved price remain. */
export function formationLiveBlockers(code: string, entityType: EntityType): string[] {
  const j = getRaJurisdiction(code);
  if (!j) return ["Unknown jurisdiction."];
  const out: string[] = nationwideBlockers();
  if (j.providerCoverage === "not_confirmed") out.push("The provider's coverage of this jurisdiction is not confirmed.");
  if (!fulfillmentTested(j)) out.push("No end-to-end test order with the provider yet.");
  if (!RA_ENTITY_TYPES.includes(entityType)) out.push("This entity type is not supported.");
  if (formationFeeCents(code, entityType) === null) out.push("Formation fee not verified for this entity type.");
  for (const b of [...stateSpecificBlockers(j), ...j.formationBlockers]) if (!out.includes(b)) out.push(b);
  return out;
}

export interface SaleCheck {
  ok: boolean;
  reason: string | null;
}

/** Whether registered agent service can be bought here right now (in this environment). */
export function raSaleCheck(code: string, entityType: EntityType, situation: RaSituation): SaleCheck {
  const j = getRaJurisdiction(code);
  if (!j) return { ok: false, reason: "We don't offer registered agent service there." };
  if (!raSwitchOn(j.code)) return { ok: false, reason: `Registered agent service isn't open in ${j.name} yet.` };
  if (!RA_ENTITY_TYPES.includes(entityType)) return { ok: false, reason: "We can't serve this type of business yet." };
  // A government fee is never guessed, in any environment.
  if (situation === "switching" && changeOfAgentFeeCents(j.code, entityType) === null) {
    return { ok: false, reason: `We can't file a change of agent in ${j.name} yet.` };
  }
  if (realPaymentsPossible() && raLiveBlockers(j.code, entityType, situation).length > 0) {
    return { ok: false, reason: `Registered agent service isn't open in ${j.name} yet.` };
  }
  return { ok: true, reason: null };
}

/** The registered agent + annual report bundle switch is on (public pages show the bundle only then). */
export function bundleSalesOpen(): boolean {
  return flag("RA_BUNDLE_SALES") === "true";
}

/** Bundle: registered agent sellable AND Filewell sells this business's annual report here. */
export function bundleSaleCheck(
  code: string,
  business: { entityType: EntityType; isForeign: boolean; isNonprofit: boolean },
  situation: RaSituation,
): SaleCheck {
  const c = code.toUpperCase();
  if (!bundleSalesOpen()) return { ok: false, reason: "The registered agent and annual report bundle isn't open yet." };
  if (!(BUNDLE_STATES as readonly string[]).includes(c)) return { ok: false, reason: "We don't file annual reports in this state, so the bundle isn't available." };
  const ra = raSaleCheck(c, business.entityType, situation);
  if (!ra.ok) return ra;
  const rule = findRule(c, business.entityType, "annual_report", business.isForeign);
  if (!rule || !isSellableForBusiness(rule, { isNonprofit: business.isNonprofit })) {
    return { ok: false, reason: "We can't file this business's annual report right now, so the bundle isn't available." };
  }
  return { ok: true, reason: null };
}

/** Formation: needs a verified state fee, the switch and, for real money, every formation blocker cleared. */
export function formationSaleCheck(code: string, entityType: EntityType): SaleCheck {
  const j = getRaJurisdiction(code);
  if (!j) return { ok: false, reason: "We don't offer formation there." };
  if (!formationSwitchOn(j.code)) return { ok: false, reason: `Business formation isn't open in ${j.name} yet.` };
  if (!RA_ENTITY_TYPES.includes(entityType)) return { ok: false, reason: "We can only form LLCs and corporations." };
  if (formationFeeCents(j.code, entityType) === null) return { ok: false, reason: `We haven't confirmed ${j.name}'s formation fee yet.` };
  if (realPaymentsPossible() && formationLiveBlockers(j.code, entityType).length > 0) {
    return { ok: false, reason: `Business formation isn't open in ${j.name} yet.` };
  }
  return { ok: true, reason: null };
}
