import type { EntityType } from "@/lib/domain/types";
import { JURISDICTIONS } from "./jurisdictions";
import { stateSalesEnabled } from "./launch";
import { NEVADA_RULES } from "./states/nevada";
import { PENNSYLVANIA_RULES } from "./states/pennsylvania";
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
export const RULES: ComplianceRuleDef[] = [...PENNSYLVANIA_RULES, ...WASHINGTON_RULES, ...NEVADA_RULES, ...UTAH_RULES];

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

export function isStateVerified(stateCode: string): boolean {
  return RULES.some((r) => r.stateCode === stateCode && r.verificationStatus === "verified");
}

/**
 * A rule can be sold only when it is verified, the state is supported, and the state's
 * live-filing switch is on (see ./launch). Checkout separately requires an approved price.
 */
export function isRuleSellable(rule: ComplianceRuleDef): boolean {
  const j = getJurisdiction(rule.stateCode);
  return rule.verificationStatus === "verified" && !!j && j.supportLevel !== "unsupported" && stateSalesEnabled(rule.stateCode);
}
