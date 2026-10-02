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
 * v2 (2026-10-02) follows the current form (Annual Report, Revised 6.2025) and the online
 * instructions: UBI required, the four Department of Revenue controlling-interest questions
 * as the state asks them, registered-agent change/type with the new agent's consent, and the
 * state's authorized-person certification shown to the customer before they sign.
 *
 * Scope: domestic and foreign profit corporations, LLCs, LPs/LLLPs and LLPs.
 * Not yet: nonprofit corporations ($60/$20 + charitable rules), Title 24.06 entities.
 */

const VERIFIED = "2026-10-01";
const VERIFIED_V2 = "2026-10-02";
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
  paperForm:
    "https://www.sos.wa.gov/sites/default/files/2025-12/6.2025%20-%20Annual%20Report%20-%20Profit%20Entity%20Types%2023B%20M%26M%20%26%20Corp%20Sole%20%28Fillable%20Form%29.pdf",
  rcw415: "https://app.leg.wa.gov/RCW/default.aspx?cite=23.95.415",
} as const;

/** The authorized person's certification in CCFS, verbatim (online filing instructions). */
export const WA_CERTIFICATION_TEXT = "This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct.";

/** Washington's Consent to Serve as Registered Agent, verbatim (Annual Report form, Revised 6.2025, page 2). */
export const WA_RA_CONSENT_TEXT =
  "I hereby consent to serve as Registered Agent in the State of Washington for the named business. I understand it will be my responsibility to accept service of process, notices, and demands on behalf of the business; to forward mail to the business; and to immediately notify the Office of the Secretary of State if I resign or change the Registered Office Address.";

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
  src("certification", WA_URLS.onlineInstructions, "Instructions to file an Annual Report online", WA_CERTIFICATION_TEXT),
  src(
    "ra_consent",
    WA_URLS.onlineInstructions,
    "Instructions to file an Annual Report online",
    "The Consent of the Registered Agent is required if any changes other than contact info is made. By selecting one of the radio buttons under “Registered Agent Consent” the submitter is attesting to the statements listed.",
  ),
  src(
    "ra_consent_rule",
    WA_URLS.rcw415,
    "RCW 23.95.415",
    "A registered agent shall not be appointed without having given prior consent in a record to the appointment.",
    LEG,
  ),
  src("ra_consent_text", WA_URLS.paperForm, "Annual Report form (Revised 6.2025), page 2", WA_RA_CONSENT_TEXT),
  src(
    "controlling_interest",
    WA_URLS.paperForm,
    "Annual Report form (Revised 6.2025), question 6",
    "Does this entity own (hold title) real property in Washington, such as land or buildings, including leasehold improvements?",
  ),
  src(
    "controlling_interest_defaults",
    WA_URLS.onlineInstructions,
    "Instructions to file an Annual Report online",
    "All answers are initially defaulted to “No”. Review for accuracy and change the answers to “Yes” if applicable.",
  ),
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

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
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
            help: "The 9-digit Unified Business Identifier on your Washington records. Washington only accepts the report when the UBI and name match its record. You can look it up on the Secretary of State's business search.",
            required: true,
            maxLength: 30,
            pattern: "^[0-9]{3}[ -]?[0-9]{3}[ -]?[0-9]{3}$",
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
        description:
          "Washington's report confirms the registered agent. A new agent, or a new street address for the agent, needs the agent's own signed consent to serve.",
        fields: [
          {
            key: "registered_agent_change",
            type: "choice",
            label: "Is your registered agent changing with this report?",
            required: true,
            options: [
              { value: "no", label: "No: keep the registered agent on Washington's record" },
              { value: "contact", label: "Same agent and street address; only the agent's email, phone or mailing address changes" },
              { value: "new", label: "Yes: a new registered agent, or a new street address for the agent" },
            ],
          },
          {
            key: "registered_agent_type",
            type: "choice",
            label: "What kind of registered agent is it?",
            help: "A commercial registered agent is a company registered with the Secretary of State to serve as agent for many businesses. Anyone else (you, an employee, a friend) is a noncommercial agent.",
            required: true,
            options: [
              { value: "noncommercial", label: "Noncommercial (a person or business that isn't a registered commercial agent)" },
              { value: "commercial", label: "Commercial registered agent" },
            ],
          },
          { key: "registered_agent_name", type: "text", label: "Registered agent name", help: "Exactly as on the record, or the new agent's full name.", required: true, maxLength: 200 },
          {
            key: "registered_office",
            type: "address",
            label: "Registered agent street address in Washington",
            help: "Only for a noncommercial agent. A commercial agent's address is already on file with the state.",
            required: true,
            requiredWhen: [{ key: "registered_agent_type", in: ["noncommercial"] }],
            noPoBox: true,
            lockedRegion: "WA",
          },
          {
            key: "registered_agent_email",
            type: "email",
            label: "Registered agent email",
            help: "Only for a noncommercial agent whose details change. Washington requires an email for the agent.",
            required: true,
            requiredWhen: [
              { key: "registered_agent_type", in: ["noncommercial"] },
              { key: "registered_agent_change", in: ["contact", "new"] },
            ],
          },
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
        key: "controlling_interest",
        title: "Department of Revenue questions",
        description:
          "Washington's report asks these real estate excise tax questions (RCW 82.45.220) exactly as worded here. We enter your answers as you give them.",
        fields: [
          {
            key: "ci_owns_real_property",
            type: "choice",
            label: "1. Does this entity own (hold title) real property in Washington, such as land or buildings, including leasehold improvements?",
            required: true,
            options: YES_NO,
          },
          {
            key: "ci_transfer_16",
            type: "choice",
            label: "2. In the past 12 months, has there been a transfer of at least 16 percent of the ownership, stock, or other financial interest in the entity?",
            required: true,
            options: YES_NO,
          },
          {
            key: "ci_transfer_controlling",
            type: "choice",
            label:
              "2a. If \"yes\", in the past 36 months, has there been a transfer of controlling interest (50 percent or greater) of the ownership, stock, or other financial interest in the entity?",
            help: "Answer only if you answered Yes to question 2.",
            required: true,
            requiredWhen: [{ key: "ci_transfer_16", in: ["yes"] }],
            options: YES_NO,
          },
          {
            key: "ci_return_filed",
            type: "choice",
            label:
              "3. If you answered \"yes\" to question 1 AND 2a, has the controlling interest transfer return been filed with Department of Revenue?",
            help: "Answer only if you answered Yes to questions 1 and 2a.",
            required: true,
            requiredWhen: [
              { key: "ci_owns_real_property", in: ["yes"] },
              { key: "ci_transfer_controlling", in: ["yes"] },
            ],
            options: YES_NO,
          },
        ],
      },
      {
        key: "extras",
        title: "Anything else",
        fields: [
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
    // v1 (effective 2026-10-01) never took an order. v2 matches the current form and online
    // instructions (UBI, controlling-interest questions, registered-agent consent).
    version: 2,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED_V2,
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
      "Answers to the Department of Revenue controlling-interest questions",
      "The new agent's signed consent, if the registered agent changes",
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
        "Express Annual Report (for-profit entities with a previous annual report on record) needs no CCFS login; otherwise a free CCFS user account (accounts aren't tied to one business). CCFS runs a Cloudflare check: complete it by hand, never automate it. The operator types their own name as the authorized person and may certify only the customer-authorized packet.",
      steps: [
        "Open the filing packet and confirm the customer authorization is current (no changes after signing) and any registered agent consent is on file.",
        "Open CCFS Express Annual Report: \"with changes\" if the packet changes anything on the record, otherwise \"without changes\". Search by UBI number.",
        "Check the status and expiration date CCFS shows. If the status is Delinquent the state adds $25: pay it only if the order collected it, otherwise contact the customer first.",
        "Go through each CCFS section in order and make every value match the packet exactly. Controlling-interest answers default to \"No\" in CCFS: set each one to the customer's answer.",
        "Registered Agent Consent: select a consent statement only if it is true and the consent is on file (customer is the agent and signed Washington's consent in Filewell, or a signed consent is uploaded). Otherwise stop.",
        "Effective date: Date of Filing. Leave Return Address and Upload blank unless the packet says otherwise.",
        "On the CCFS review screen, compare every value against the packet, then record the comparison checkpoint in Filewell.",
        "Authorized Person: type your full name and tick the certification. Add to cart, check out and pay by card.",
        "Save the submission confirmation and the filed document, then Mark submitted with the confirmation number and upload the document.",
      ],
      fieldMap: [
        { section: "Business Information", portalField: "UBI number", answerKey: "entity_number" },
        { section: "Business Information", portalField: "Business name", answerKey: "legal_name" },
        { section: "Registered Agent", portalField: "Change to the registered agent", answerKey: "registered_agent_change" },
        { section: "Registered Agent", portalField: "Agent type", answerKey: "registered_agent_type" },
        { section: "Registered Agent", portalField: "Registered agent name", answerKey: "registered_agent_name" },
        { section: "Registered Agent", portalField: "Registered agent street address (Washington)", answerKey: "registered_office" },
        { section: "Registered Agent", portalField: "Registered agent email", answerKey: "registered_agent_email" },
        {
          section: "Registered Agent",
          portalField: "Registered Agent Consent",
          answerKey: null,
          note: "Only if the agent changes: select the statement that matches the consent on file. Never select one without it.",
        },
        { section: "Principal Office", portalField: "Principal office street address", answerKey: "principal_office" },
        { section: "Principal Office", portalField: "Email", answerKey: "state_notice_email" },
        { section: "Governors", portalField: "Governors", answerKey: "governors" },
        { section: "Nature of Business", portalField: "Nature of business (drop-down or \"other\")", answerKey: "nature_of_business" },
        { section: "Effective Date", portalField: "Effective date", answerKey: null, note: "Date of Filing" },
        { section: "Controlling Interest", portalField: "1. Owns real property in Washington", answerKey: "ci_owns_real_property" },
        { section: "Controlling Interest", portalField: "2. Transfer of at least 16% in the past 12 months", answerKey: "ci_transfer_16" },
        { section: "Controlling Interest", portalField: "2a. Controlling-interest transfer in the past 36 months", answerKey: "ci_transfer_controlling" },
        { section: "Controlling Interest", portalField: "3. Controlling interest transfer return filed", answerKey: "ci_return_filed" },
        { section: "Return Address for this Filing", portalField: "Return address", answerKey: null, note: "Leave blank" },
        { section: "Upload additional documents", portalField: "Upload", answerKey: null, note: "Leave blank" },
        {
          section: "Authorized Person",
          portalField: "Authorized person and certification",
          answerKey: null,
          note: "Your own name, as the customer's authorized filing agent. Certify only after the comparison checkpoint.",
        },
      ],
      confirmationLabel: "CCFS submission / filing confirmation number",
      receipt: "The filed annual report or confirmation letter from CCFS (PDF).",
    },
    stateAuthorization: {
      certificationText: WA_CERTIFICATION_TEXT,
      certificationSourceFactKey: "certification",
      registeredAgentConsent: {
        changeKey: "registered_agent_change",
        consentRequiredWhen: ["new"],
        agentNameKey: "registered_agent_name",
        consentText: WA_RA_CONSENT_TEXT,
        sourceFactKey: "ra_consent",
      },
      operatorCheckpoint: true,
    },
    sources: COMMON,
    lastVerifiedAt: VERIFIED_V2,
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
