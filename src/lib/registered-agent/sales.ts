import { isProductionEnvironment } from "@/config/site";
import { findRule, isSellableForBusiness, realPaymentsPossible } from "@/lib/compliance/registry";
import type { EntityType } from "@/lib/domain/types";
import { changeOfAgentFeeCents, formationFeeCents, getRaJurisdiction } from "./jurisdictions";

/**
 * Sales switches for business services. Every one fails closed.
 *
 *   RA_PROVIDER_AGREEMENT_SIGNED=true   the wholesale Service Agreement is signed (owner sets it)
 *   RA_SALES_<CODE>=true                registered agent checkout open in that jurisdiction
 *   RA_BUNDLE_SALES=true                the registered agent + annual report bundle may be sold
 *   FORMATION_SALES_<CODE>=true         formation checkout open in that jurisdiction
 *   BUSINESS_SERVICES_PAGES=true        public registered agent / formation pages on production
 *
 * A switch alone never opens real-money sales: where real money could be taken (production
 * or live keys) every jurisdiction blocker must also be cleared, and checkout separately
 * refuses any service price an admin has not approved. A sandbox or Stripe test deployment
 * may run the journeys with only the switch, so the flows can be tested end to end, but
 * even there a government fee is never guessed: an unverified fee blocks the quote.
 */

const flag = (name: string) => process.env[name]?.trim();

export type RaSituation = "switching" | "new_entity";

/** Entity types the registered agent service is built for. */
export const RA_ENTITY_TYPES: EntityType[] = ["llc", "corporation"];

/** Annual-report states where Filewell files itself: the only places a bundle can exist. */
export const BUNDLE_STATES = ["PA", "CO", "FL", "SD", "MT", "MI"] as const;

export function providerAgreementSigned(): boolean {
  return flag("RA_PROVIDER_AGREEMENT_SIGNED") === "true";
}

export function raSwitchOn(code: string): boolean {
  return flag(`RA_SALES_${code.toUpperCase()}`) === "true";
}

/** Public business-services pages: always on outside production, on production only by switch. */
export function businessServicesPagesEnabled(): boolean {
  return !isProductionEnvironment() || flag("BUSINESS_SERVICES_PAGES") === "true";
}

/**
 * Everything standing between this jurisdiction and real-money registered agent sales, in
 * plain words. Empty means only the switch and an approved price remain.
 */
export function raLiveBlockers(code: string, entityType: EntityType, situation: RaSituation): string[] {
  const j = getRaJurisdiction(code);
  if (!j) return ["Unknown jurisdiction."];
  const out: string[] = [];
  if (!providerAgreementSigned()) out.push("Wholesale Service Agreement not signed.");
  if (j.providerCoverage !== "confirmed_by_provider") out.push("Provider coverage not confirmed in writing for this jurisdiction.");
  if (!j.fulfillmentReady) out.push("No operator test order completed for this jurisdiction.");
  if (!RA_ENTITY_TYPES.includes(entityType)) out.push("This entity type is not supported.");
  if (situation === "switching" && changeOfAgentFeeCents(code, entityType) === null) out.push("Change of agent fee not verified for this entity type.");
  if (situation === "new_entity" && !j.appointmentProcess) out.push("How a new entity names the agent here is not verified.");
  for (const b of j.knownBlockers) if (!out.includes(b) && !b.startsWith("Wholesale Service Agreement") && !b.startsWith("No operator test order")) out.push(b);
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

/** Bundle: registered agent sellable AND Filewell sells this business's annual report here. */
export function bundleSaleCheck(
  code: string,
  business: { entityType: EntityType; isForeign: boolean; isNonprofit: boolean },
  situation: RaSituation,
): SaleCheck {
  const c = code.toUpperCase();
  if (flag("RA_BUNDLE_SALES") !== "true") return { ok: false, reason: "The registered agent and annual report bundle isn't open yet." };
  if (!(BUNDLE_STATES as readonly string[]).includes(c)) return { ok: false, reason: "We don't file annual reports in this state, so the bundle isn't available." };
  const ra = raSaleCheck(c, business.entityType, situation);
  if (!ra.ok) return ra;
  const rule = findRule(c, business.entityType, "annual_report", business.isForeign);
  if (!rule || !isSellableForBusiness(rule, { isNonprofit: business.isNonprofit })) {
    return { ok: false, reason: "We can't file this business's annual report right now, so the bundle isn't available." };
  }
  return { ok: true, reason: null };
}

/** Formation: needs a verified state fee, the switch and, for real money, the provider agreement. */
export function formationSaleCheck(code: string, entityType: EntityType): SaleCheck {
  const j = getRaJurisdiction(code);
  if (!j) return { ok: false, reason: "We don't offer formation there." };
  if (flag(`FORMATION_SALES_${j.code}`) !== "true") return { ok: false, reason: `Business formation isn't open in ${j.name} yet.` };
  if (formationFeeCents(j.code, entityType) === null) return { ok: false, reason: `We haven't confirmed ${j.name}'s formation fee yet.` };
  if (realPaymentsPossible() && (!providerAgreementSigned() || !j.fulfillmentReady)) {
    return { ok: false, reason: `Business formation isn't open in ${j.name} yet.` };
  }
  return { ok: true, reason: null };
}
