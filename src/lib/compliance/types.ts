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
      /** Also collect an address for each person (e.g. Nevada lists the address of every officer). */
      withAddress?: { label: string; help?: string };
    })
  | (BaseField & {
      type: "choice";
      options: { value: string; label: string }[];
      /** Answers Filewell can't file online yet; choosing one shows this message and blocks the step. */
      blocked?: { value: string; message: string }[];
    });

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

// --- Government fees ----------------------------------------------------------

/**
 * One government charge that is always due with the filing (e.g. Nevada: the Annual
 * List fee and the State Business License fee are separate components). When a rule has
 * no components, its single `stateFeeCents` is the whole government fee.
 */
export interface GovFeeComponent {
  key: string;
  label: string;
  cents: number;
  /** Amount for a not-for-profit entity, if the state distinguishes (0 = exempt). */
  nonprofitCents?: number | null;
  /** factKey of the RuleSource that states this amount. */
  sourceFactKey: string;
}

/**
 * A government late/delinquency charge and exactly what triggers it, as the official
 * source states it. Filewell never infers a status-based charge from dates.
 */
export interface LateFeeRule {
  key: string;
  label: string;
  cents: number;
  trigger:
    /** Applies only when the state's own record shows one of these statuses (e.g. WA "Delinquent"). */
    | { kind: "state_status"; statuses: string[] }
    /** Applies when the filing is submitted after the due date (+ grace days), per the official rule. */
    | { kind: "filed_after_due_date"; graceDays?: number };
  /** Not charged to not-for-profit entities, where the source says so. */
  exemptNonprofit?: boolean;
  sourceFactKey: string;
}

/** How a Filewell operator files this by hand in the state's portal (never automated). */
export interface OperatorRunbook {
  portalName: string;
  portalUrl: string;
  /** What access the operator needs (account, credential, entity authorization). */
  access: string;
  steps: string[];
  /** State portal field -> intake answer key (null = a fixed instruction in `note`). */
  fieldMap: { portalField: string; answerKey: string | null; note?: string }[];
  /** What the state calls the confirmation to record in "Mark submitted". */
  confirmationLabel: string;
  /** What to upload as the customer's receipt. */
  receipt: string;
}

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
  /** Separate government fee components (optional; sum equals stateFeeCents). */
  feeComponents?: GovFeeComponent[];
  /** Verified late/delinquency charges with their triggers (optional). */
  lateFees?: LateFeeRule[];
  /** How many days before the due date the state accepts the filing (optional). */
  filingWindowDaysBefore?: number;
  /** State-specific manual filing instructions for operators (optional). */
  operatorRunbook?: OperatorRunbook;
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
