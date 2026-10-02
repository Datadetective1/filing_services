import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, RuleSource } from "../types";

/**
 * Washington annual report (Secretary of State, Corporations & Charities Division).
 *
 * Checked 2026-10-01 against sos.wa.gov and the Washington Administrative Code / RCW:
 *  - Due: the entity's expiration date, the last day of the month it was formed or
 *    registered (WAC 434-112-060(1)); may be filed up to 180 days early (060(2)).
 *  - Fee: $70 for domestic and foreign profit corporations, LLCs, LPs/LLLPs and LLPs
 *    (WAC 434-112-085(7)(p)); no online processing fee on annual reports (075(1)(a)).
 *  - Delinquency fee: $25 "If the business entity's status is listed as Delinquent".
 *    Filewell applies it ONLY when Washington's own record shows "Delinquent".
 *
 * Public data: CCFS (ccfs.sos.wa.gov) is behind a Cloudflare challenge and the bulk
 * "Corporations Data Extract" is discontinued. Advanced search by expiration date with a
 * CSV export is available to a person using a browser; Filewell imports such an export
 * (done by an operator) and never automates CCFS.
 *
 * Scope (v1): domestic and foreign profit corporations, LLCs, LPs/LLLPs and LLPs.
 * Not yet: nonprofit corporations ($60/$20 + charitable rules), Title 24.06 entities.
 */

const VERIFIED = "2026-10-01";
const REVIEWER = "Official-source verification (sos.wa.gov, WAC, RCW; automated research, quotes verbatim)";
const SOS = "Washington Secretary of State";
const LEG = "Washington State Legislature";

export const WA_URLS = {
  forms: "https://www.sos.wa.gov/corporations-charities/business-entities/filings-forms-information",
  faq: "https://www.sos.wa.gov/corporations-charities/frequently-asked-questions-faqs/annual-reports",
  ccfsFaq: "https://www.sos.wa.gov/corporations-charities/frequently-asked-questions-faqs/corporations-charities-filing-system-tools-resources",
  onlineInstructions:
    "https://www.sos.wa.gov/corporations-charities/business-entities/online-filing-instructions/file-annual-report-multiple-entity-types-online",
  returnActive: "https://www.sos.wa.gov/corporations-charities/business-entities/return-business-active-status",
  processing: "https://www.sos.wa.gov/corporations-charities/processing-guidelines-and-procedure",
  wac060: "https://app.leg.wa.gov/WAC/default.aspx?cite=434-112-060",
  wac075: "https://app.leg.wa.gov/WAC/default.aspx?cite=434-112-075",
  wac085: "https://app.leg.wa.gov/WAC/default.aspx?cite=434-112-085",
  rcw255: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.255",
  rcw605: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.605",
  rcw240: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.240",
  ccfs: "https://ccfs.sos.wa.gov/",
  expressAnnualReport: "https://ccfs.sos.wa.gov/#/expressAnnualReportSearch/BusinessSearch",
  advancedSearch: "https://ccfs.sos.wa.gov/#/AdvancedSearch",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = SOS): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

const COMMON: RuleSource[] = [
  src(
    "due_date",
    WA_URLS.forms,
    "Filings, forms and information",
    "An Annual Report is due by the business entity's expiration date, which is the last day of the month in which the business was first formed/registered with the Secretary of State",
  ),
  src(
    "due_date_rule",
    WA_URLS.wac060,
    "WAC 434-112-060(1)",
    "must file an annual report accompanied by the fee established under WAC 434-112-085 by the last day of the month that the entity was formed or registered by the division.",
    LEG,
  ),
  src("early_filing", WA_URLS.wac060, "WAC 434-112-060(2)", "An annual report may be filed up to 180 days prior to the due date.", LEG),
  src("state_fee", WA_URLS.forms, "Filings, forms and information", "Profit Business Entity Types, including LLC $70"),
  src("state_fee_rule", WA_URLS.wac085, "WAC 434-112-085(7)(p)", "Annual report Seventy dollars", LEG),
  src("no_processing_fee", WA_URLS.wac075, "WAC 434-112-075(1)(a)", "an online processing fee of $20, with the exception of: (a) Annual reports", LEG),
  src(
    "delinquency_fee",
    WA_URLS.forms,
    "Filings, forms and information",
    "If the business entity's status is listed as Delinquent an additional $25 delinquency fee will be assessed.",
  ),
  src("delinquency_fee_rule", WA_URLS.wac085, "WAC 434-112-085(7)(r)", "Delinquent fee Twenty-five dollars", LEG),
  src(
    "delinquent_status",
    WA_URLS.faq,
    "Annual reports FAQ",
    "Failure to file on or before the expiration date results in a delinquent status and may lead to administrative dissolution.",
  ),
  src(
    "dissolution",
    WA_URLS.rcw605,
    "RCW 23.95.605(2)",
    "The entity does not deliver an annual report ... not later than one hundred twenty days after it is due",
    LEG,
  ),
  src("required_contents", WA_URLS.rcw255, "RCW 23.95.255(2)", "brief description of the nature of the entity's business", LEG),
  src(
    "express_annual_report",
    WA_URLS.ccfsFaq,
    "CCFS tools and resources",
    "Customers who only need to file an annual report can take advantage of our Express Annual Report Option. To be eligible, a previous Annual Report must already be filed on record.",
  ),
  src(
    "authorized_filer",
    WA_URLS.rcw240,
    "RCW 23.95.240(2)",
    "A person that executes an entity filing as an agent or legal representative thereby affirms as a fact that the person is authorized",
    LEG,
  ),
  src("on_time", WA_URLS.processing, "Processing guidelines", "Electronically submitted before midnight on the due date"),
];

interface WaProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  governorLabel: string;
  governorHelp: string;
  governorTitles: string[];
}

const PROFILES: WaProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    governorLabel: "Governors (managers or members)",
    governorHelp: "Washington calls them governors: the LLC's managers, or its members if it has no managers.",
    governorTitles: ["Governor", "Manager", "Member"],
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "profit corporations",
    governorLabel: "Governors (directors)",
    governorHelp: "Washington calls a corporation's directors its governors.",
    governorTitles: ["Governor", "Director"],
  },
  {
    entityType: "lp",
    noun: "limited partnership",
    pluralNoun: "limited partnerships (including LLLPs)",
    governorLabel: "Governors (general partners)",
    governorHelp: "Washington calls a limited partnership's general partners its governors.",
    governorTitles: ["Governor", "General Partner"],
  },
  {
    entityType: "llp",
    noun: "limited liability partnership",
    pluralNoun: "limited liability partnerships",
    governorLabel: "Governors (partners)",
    governorHelp: "Washington calls a limited liability partnership's partners its governors.",
    governorTitles: ["Governor", "Partner"],
  },
];

function intakeFor(p: WaProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Washington business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "UBI number",
            help: "The 9-digit Unified Business Identifier on your Washington records. Leave blank if you don't have it.",
            required: false,
            maxLength: 30,
            pattern: "^[0-9-]{9,11}$",
            patternMessage: "A UBI number has 9 digits.",
          },
          {
            key: "jurisdiction_of_formation",
            type: "text",
            label: "Jurisdiction of formation",
            help: "Washington, or the state or country where a foreign entity was formed.",
            required: true,
            maxLength: 100,
          },
          {
            key: "nature_of_business",
            type: "text",
            label: "Nature of business",
            help: "A brief description, for example \"residential plumbing\".",
            required: true,
            maxLength: 200,
          },
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        description: "Washington's report confirms the registered agent. Changing the agent needs the new agent's consent.",
        fields: [
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered agent street address in Washington", required: true, noPoBox: true, lockedRegion: "WA" },
        ],
      },
      {
        key: "principal_office",
        title: "Principal office",
        fields: [
          { key: "principal_office", type: "address", label: "Principal office street address", required: true, noPoBox: true },
          {
            key: "state_notice_email",
            type: "email",
            label: "Business email",
            help: "Washington's online annual report requires an email address for the business.",
            required: true,
          },
        ],
      },
      {
        key: "people",
        title: "Governors",
        fields: [
          {
            key: "governors",
            type: "people",
            label: p.governorLabel,
            help: p.governorHelp,
            required: true,
            min: 1,
            max: 20,
            titleSuggestions: p.governorTitles,
          },
        ],
      },
      {
        key: "extras",
        title: "Anything else",
        fields: [
          {
            key: "controlling_interest",
            type: "choice",
            label: "Has a controlling interest (50% or more) in the business changed hands?",
            help: "Washington's report includes Department of Revenue questions about controlling-interest transfers. We'll enter your answer exactly as the state form asks it.",
            required: true,
            options: [
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
              { value: "unsure", label: "Not sure" },
            ],
          },
          {
            key: "changes_since_last_report",
            type: "choice",
            label: "Has any of this changed since your last annual report?",
            required: false,
            options: [
              { value: "no", label: "No changes" },
              { value: "yes", label: "Yes, something changed" },
              { value: "first", label: "This is our first annual report" },
              { value: "unsure", label: "Not sure" },
            ],
          },
        ],
      },
    ],
  };
}

function buildRule(p: WaProfile): ComplianceRuleDef {
  return {
    ruleKey: `WA:annual_report:${p.entityType}`,
    stateCode: "WA",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Annual Report",
    dueRule: { kind: "anniversary_month_end" },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 7000,
    nonprofitStateFeeCents: null,
    lateFeeCents: 2500,
    lateFees: [
      { key: "delinquency_fee", label: "Delinquency fee", cents: 2500, trigger: { kind: "state_status", statuses: ["Delinquent"] }, sourceFactKey: "delinquency_fee" },
    ],
    filingWindowDaysBefore: 180,
    lateFeeSummary: "If Washington lists the business's status as Delinquent, the state adds a $25 delinquency fee.",
    consequenceSummary:
      "Missing the expiration date puts the business in delinquent status. If the report still isn't filed 120 days after it's due, Washington may begin administrative dissolution (with 60 days to cure after notice); foreign entities face termination of their registration.",
    whoMustFile: `Every Washington ${p.noun} and every foreign ${p.noun} registered in Washington files an annual report by its expiration date each year.`,
    requiredInformation: [
      "Legal name, UBI number and jurisdiction of formation",
      "Registered agent name and Washington street address",
      "Principal office street address and an email address",
      "Names of the governors",
      "A brief description of the nature of the business",
      "Department of Revenue controlling-interest questions",
    ],
    intake: intakeFor(p),
    officialFilingUrl: WA_URLS.ccfs,
    officialInfoUrl: WA_URLS.forms,
    filingMethodSummary:
      "Filed online in the Corporations and Charities Filing System (CCFS). Businesses with a previous annual report on record can use the Express Annual Report option; the regular annual report is filed from a CCFS account. Paid by card.",
    processingSummary:
      "Online filing gives immediate submission confirmation; without an upload the information shows on the record right away and the expiration date moves to next year.",
    customerSummary: `Washington ${p.pluralNoun} file an annual report by their expiration date (the last day of the month they were formed or registered), with a $70 state fee. A $25 delinquency fee is added only if the state lists the business as Delinquent.`,
    faq: [
      {
        q: `When is a Washington ${p.noun}'s annual report due?`,
        a: "By its expiration date: the last day of the month it was formed or registered with the Secretary of State. You can file up to 180 days early, and filing early doesn't change the expiration date.",
      },
      { q: "How much is the state fee?", a: "$70, paid to the Washington Secretary of State. There's no online processing fee on annual reports." },
      {
        q: "Is there a late fee?",
        a: "Washington adds a $25 delinquency fee if the business's status is listed as Delinquent, which happens when the report isn't filed by the expiration date.",
      },
      { q: "Can I file it myself?", a: "Yes. You can file directly with the Washington Secretary of State online through CCFS. Using a filing service is optional." },
    ],
    operatorRunbook: {
      portalName: "Washington CCFS (Corporations and Charities Filing System)",
      portalUrl: WA_URLS.expressAnnualReport,
      access:
        "Express Annual Report (for-profit entities with a previous annual report on record) appears to need no CCFS login; otherwise a free CCFS user account (accounts aren't tied to one business). The operator types their own name as the authorized person and must hold the customer's signed authorization. Complete the CCFS Cloudflare check by hand.",
      steps: [
        "Open CCFS Express Annual Report and search the business by UBI number.",
        "Check the status and expiration date shown. If the status is Delinquent, the state charges $25 more: confirm the order covers it before paying.",
        "Choose Express Annual Report with changes if anything below differs from the record, otherwise without changes.",
        "Enter or confirm each field from the table below. A new registered agent needs the agent's consent.",
        "Answer the Department of Revenue controlling-interest questions as the customer answered.",
        "Type your full name in the authorized person section, attest, and pay by card.",
        "Save the submission confirmation and the filed document (Notices and Filed Documents, or the confirmation email).",
      ],
      fieldMap: [
        { portalField: "UBI number", answerKey: "entity_number" },
        { portalField: "Business name", answerKey: "legal_name" },
        { portalField: "Registered agent", answerKey: "registered_agent_name" },
        { portalField: "Registered agent street address", answerKey: "registered_office" },
        { portalField: "Principal office street address", answerKey: "principal_office" },
        { portalField: "Email (principal office and agent)", answerKey: "state_notice_email" },
        { portalField: "Governors", answerKey: "governors" },
        { portalField: "Nature of business", answerKey: "nature_of_business" },
        { portalField: "Controlling interest questions", answerKey: "controlling_interest" },
        { portalField: "Authorized person", answerKey: null, note: "Your own name, filing as authorized agent under the customer's authorization" },
      ],
      confirmationLabel: "CCFS submission / filing confirmation number",
      receipt: "The filed annual report or confirmation letter from CCFS (PDF).",
    },
    sources: COMMON,
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
  };
}

export const WASHINGTON_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

export const WASHINGTON_FACTS = {
  businessSearchUrl: WA_URLS.advancedSearch,
  portalUrl: WA_URLS.ccfs,
  expressUrl: WA_URLS.expressAnnualReport,
  lookupMethod: "manual" as const,
};
