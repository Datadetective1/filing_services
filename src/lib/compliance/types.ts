import type { EntityType, ISODate, SupportLevel, VerificationStatus } from "@/lib/domain/types";

export type DueRule =
  /** Same calendar date every year (e.g. Pennsylvania LLCs: September 30). */
  | { kind: "fixed_annual"; month: number; day: number }
  /** Last day of the formation anniversary month, every `intervalYears` years. */
  | { kind: "anniversary_month_end"; intervalYears?: 1 | 2 }
  /** The formation anniversary date, every `intervalYears` years. */
  | { kind: "anniversary_date"; intervalYears?: 1 | 2 };

export type FirstDueRule =
  /** First report is due in the calendar year after formation/registration. */
  | { kind: "year_after_formation" }
  /** First report is due in the formation year. */
  | { kind: "formation_year" };

export interface RuleSource {
  factKey: string;
  url: string;
  title: string;
  publisher: string;
  /** Short verbatim excerpt from the official page that supports the fact. */
  quote: string;
  lastVerifiedAt: ISODate;
}

export interface FaqItem {
  q: string;
  a: string;
}

// --- Data-driven intake -----------------------------------------------------

interface BaseField {
  key: string;
  label: string;
  help?: string;
  required: boolean;
}

export type IntakeField =
  | (BaseField & { type: "text"; maxLength?: number; pattern?: string; patternMessage?: string; placeholder?: string })
  | (BaseField & { type: "email" })
  | (BaseField & {
      type: "address";
      /** Reject addresses that are only a P.O. box. */
      noPoBox?: boolean;
      /** Restrict to a single state (two-letter code). */
      lockedRegion?: string;
      requireCounty?: boolean;
    })
  | (BaseField & {
      /** Registered office: a street address in the state OR a commercial registered office provider + county. */
      type: "registered_office";
      region: string;
    })
  | (BaseField & {
      type: "people";
      min: number;
      max: number;
      titleSuggestions: string[];
      /** Titles that must all be present (e.g. president, secretary, treasurer). */
      requiredTitles?: string[];
    })
  | (BaseField & { type: "choice"; options: { value: string; label: string }[] });

export interface IntakeSection {
  key: string;
  title: string;
  description?: string;
  fields: IntakeField[];
}

export interface IntakeSchema {
  sections: IntakeSection[];
}

// --- Rules ------------------------------------------------------------------

export interface ComplianceRuleDef {
  ruleKey: string; // "PA:annual_report:llc"
  stateCode: string;
  filingTypeCode: string;
  entityType: EntityType;
  appliesTo: "domestic" | "foreign" | "domestic_and_foreign";
  version: number;
  verificationStatus: VerificationStatus;
  effectiveFrom: ISODate;
  filingName: string;
  formNumber?: string;
  dueRule: DueRule;
  firstDueRule: FirstDueRule;
  /** First calendar year in which the state required this filing at all. */
  firstRequiredYear?: number;
  stateFeeCents: number;
  /** Fee when the entity has a not-for-profit purpose, if the state distinguishes. */
  nonprofitStateFeeCents?: number | null;
  /** null when the state publishes no late fee. */
  lateFeeCents: number | null;
  lateFeeSummary: string;
  consequenceSummary: string;
  whoMustFile: string;
  requiredInformation: string[];
  intake: IntakeSchema;
  officialFilingUrl: string;
  officialInfoUrl: string;
  filingMethodSummary: string;
  processingSummary: string;
  customerSummary: string;
  faq: FaqItem[];
  sources: RuleSource[];
  lastVerifiedAt: ISODate;
  verifiedBy: string;
  notes?: string;
}

export interface JurisdictionDef {
  code: string;
  name: string;
  slug: string;
  timezone: string;
  supportLevel: SupportLevel;
  filingEnabled: boolean;
  agency: {
    name: string;
    websiteUrl: string;
    businessSearchUrl: string | null;
    /** The name the state uses for its periodic report, where confirmed on an official page. */
    periodicReportName: string | null;
    verificationStatus: VerificationStatus;
    lastVerifiedAt: ISODate | null;
  };
}
