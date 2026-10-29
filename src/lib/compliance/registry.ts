import { isProductionEnvironment } from "@/config/site";
import { salesBlockingQuestionsFor } from "./open-questions";
import type { EntityType } from "@/lib/domain/types";
import { JURISDICTIONS } from "./jurisdictions";
import { EXPANSION_STATES, stateSalesEnabled } from "./launch";
import { COLORADO_RULES } from "./states/colorado";
import { FLORIDA_RULES } from "./states/florida";
import { MICHIGAN_RULES } from "./states/michigan";
import { MONTANA_RULES } from "./states/montana";
import { NEVADA_RULES } from "./states/nevada";
import { PENNSYLVANIA_RULES } from "./states/pennsylvania";
import { SOUTH_DAKOTA_RULES } from "./states/south-dakota";
import { UTAH_RULES } from "./states/utah";
import { WASHINGTON_RULES } from "./states/washington";
import type { ComplianceRuleDef, JurisdictionDef } from "./types";

/**
 * The compliance registry is the single source of truth for filing rules. It is
 * versioned in code (reviewed changes, tested) and seeded into the database, where
 * each version becomes an immutable row that orders reference.
 *
 * Only rules with verificationStatus "verified" may be shown as definitive facts or
 * sold. Adding a state = adding a rules module here, with official sources.
 */
export const RULES: ComplianceRuleDef[] = [
  ...PENNSYLVANIA_RULES,
  ...WASHINGTON_RULES,
  ...NEVADA_RULES,
  ...UTAH_RULES,
  ...FLORIDA_RULES,
  ...COLORADO_RULES,
  ...SOUTH_DAKOTA_RULES,
  ...MONTANA_RULES,
  ...MICHIGAN_RULES,
];

export const FILING_TYPES = [
  {
    code: "annual_report",
    name: "Annual report",
    description: "Periodic report that keeps a business entity's state record current.",
    category: "periodic",
    launchEnabled: true,
    sortOrder: 1,
  },
  // Future products — modeled now so data and pricing can attach later. Not sold yet.
  { code: "biennial_report", name: "Biennial report", description: null, category: "periodic", launchEnabled: false, sortOrder: 2 },
  { code: "franchise_tax_report", name: "Franchise tax report", description: null, category: "tax", launchEnabled: false, sortOrder: 3 },
  { code: "registered_agent", name: "Registered agent service", description: null, category: "registered_agent", launchEnabled: false, sortOrder: 4 },
  { code: "foreign_qualification", name: "Foreign qualification", description: null, category: "formation", launchEnabled: false, sortOrder: 5 },
  { code: "amendment", name: "Amendment", description: null, category: "amendment", launchEnabled: false, sortOrder: 6 },
  { code: "dba", name: "DBA / fictitious name", description: null, category: "other", launchEnabled: false, sortOrder: 7 },
  { code: "good_standing_certificate", name: "Certificate of good standing", description: null, category: "certificate", launchEnabled: false, sortOrder: 8 },
  { code: "dissolution", name: "Dissolution", description: null, category: "dissolution", launchEnabled: false, sortOrder: 9 },
  { code: "formation", name: "Business formation", description: null, category: "formation", launchEnabled: false, sortOrder: 10 },
  { code: "compliance_monitoring", name: "Compliance monitoring", description: null, category: "monitoring", launchEnabled: false, sortOrder: 11 },
] as const;

export function getJurisdiction(code: string): JurisdictionDef | undefined {
  return JURISDICTIONS.find((j) => j.code === code.toUpperCase());
}

export function getJurisdictionBySlug(slug: string): JurisdictionDef | undefined {
  return JURISDICTIONS.find((j) => j.slug === slug);
}

export function listJurisdictions(): JurisdictionDef[] {
  return JURISDICTIONS;
}

export function rulesForState(stateCode: string, filingTypeCode = "annual_report"): ComplianceRuleDef[] {
  return RULES.filter((r) => r.stateCode === stateCode && r.filingTypeCode === filingTypeCode);
}

export function findRule(
  stateCode: string,
  entityType: EntityType,
  filingTypeCode = "annual_report",
  isForeign = false,
): ComplianceRuleDef | undefined {
  return RULES.find(
    (r) =>
      r.stateCode === stateCode &&
      r.filingTypeCode === filingTypeCode &&
      r.entityType === entityType &&
      (r.appliesTo === "domestic_and_foreign" || r.appliesTo === (isForeign ? "foreign" : "domestic")),
  );
}

/**
 * A state's customer-authorization requirements and portal runbook (Washington), shared by
 * all its annual-report rules. null for states without one.
 */
export function stateAuthorizationForState(stateCode: string, filingTypeCode = "annual_report") {
  const rule = RULES.find((r) => r.stateCode === stateCode && r.filingTypeCode === filingTypeCode && r.stateAuthorization && r.operatorRunbook);
  return rule ? { rule, auth: rule.stateAuthorization!, runbook: rule.operatorRunbook! } : null;
}

/**
 * The customer-authorization requirements and portal runbook of this entity's own rule.
 * Use this wherever the wording or the portal fields differ by entity type (Nevada's
 * declaration and corporation-only questions); stateAuthorizationForState returns the
 * state's first rule. Falls back to the state-level lookup when the entity is unknown.
 */
export function stateAuthorizationForEntity(stateCode: string, entityType: string | null | undefined, isForeign = false, filingTypeCode = "annual_report") {
  const rule = entityType ? findRule(stateCode, entityType as EntityType, filingTypeCode, isForeign) : undefined;
  if (rule?.stateAuthorization && rule.operatorRunbook) return { rule, auth: rule.stateAuthorization, runbook: rule.operatorRunbook };
  return entityType && rule ? null : stateAuthorizationForState(stateCode, filingTypeCode);
}

/**
 * Public label for a state: "Filing supported" only while Filewell can actually be paid to
 * file there (verified rules and the state's sales switch on). A verified state with sales
 * off gets the guide and free reminders, never a claim that we file.
 */
export function stateSupportLabel(stateCode: string): "Filing supported" | "Guide and free reminders" | "Not yet verified" {
  if (!isStateVerified(stateCode)) return "Not yet verified";
  return rulesForState(stateCode).some(isRuleSellable) ? "Filing supported" : "Guide and free reminders";
}

/**
 * The state's certification wording for this entity's annual-report rule, verbatim; null when
 * the state publishes none in text, undefined when no such rule exists. Per entity: Nevada
 * words its declaration differently for each entity type.
 */
export function certificationTextFor(stateCode: string, entityType: string | null | undefined, filingTypeCode = "annual_report"): string | null | undefined {
  if (!entityType) return undefined;
  const auth = findRule(stateCode, entityType as EntityType, filingTypeCode)?.stateAuthorization;
  return auth ? auth.certificationText : undefined;
}

export function isStateVerified(stateCode: string): boolean {
  return RULES.some((r) => r.stateCode === stateCode && r.verificationStatus === "verified");
}

/**
 * Whether real money could be taken here: the production deployment, or any deployment
 * allowed to use live payment keys (PAYMENTS_LIVE_ENABLED=true, see lib/payments).
 */
function realPaymentsPossible(): boolean {
  return isProductionEnvironment() || process.env.PAYMENTS_LIVE_ENABLED?.trim() === "true";
}

/**
 * A rule can be sold only when it is verified, the state is supported, and the state's
 * live-filing switch is on (see ./launch). Checkout separately requires an approved price.
 */
export function isRuleSellable(rule: ComplianceRuleDef): boolean {
  const j = getJurisdiction(rule.stateCode);
  if (!(rule.verificationStatus === "verified" && !!j && j.supportLevel !== "unsupported" && stateSalesEnabled(rule.stateCode))) return false;
  // Fail closed wherever real money could be taken: an unresolved state question blocks sales
  // even if the switch is on, unless the owner chose to take orders around it (filing stays
  // blocked). Only a sandbox/test deployment may run the other journeys.
  return !(realPaymentsPossible() && salesBlockingQuestionsFor(rule.stateCode, rule.entityType).length > 0);
}

/**
 * Sellable for this business. Washington, Nevada and Utah rules cover profit entities
 * only (nonprofit corporations are out of scope in each state file), so a business marked
 * not-for-profit is never sold there.
 */
export function isSellableForBusiness(rule: ComplianceRuleDef, business: { isNonprofit: boolean }): boolean {
  if (business.isNonprofit && (EXPANSION_STATES as readonly string[]).includes(rule.stateCode)) return false;
  return isRuleSellable(rule);
}
