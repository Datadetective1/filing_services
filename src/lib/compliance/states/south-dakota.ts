import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * South Dakota annual report (Secretary of State, Business Services).
 *
 * Checked 2026-10-29. Corporations and LLCs pay $55 online ($15 more on paper). A report
 * not filed "within the time prescribed" costs $55 more (SDCL 47-1A-122 and 47-34A-212, as
 * amended in 2025; the Secretary's instructions page still says $50, the fee page says $55).
 * Sixty days after the due date the business can be administratively dissolved.
 *
 * Due date: the Secretary has long used the anniversary month of formation. From
 * January 1, 2027, SDCL 59-11-25 lets each business file either in its anniversary month or
 * by January 31, chosen on the formation document or by a change-of-filing-date form.
 * Filewell models the anniversary month and blocks businesses on the January 31 date until
 * that rule is built (open question sd_2027_filing_date).
 *
 * Filing: no login, just the Business ID. "Any authorized person" may execute the report
 * (SDCL 59-11-24), so Filewell's operator can sign as the customer's authorized agent.
 * The report asks about agricultural land; Filewell doesn't file reports where the answer
 * is yes.
 *
 * Launch scope: LLCs and for-profit corporations only.
 */

const VERIFIED = "2026-10-29";
const REVIEWER = "Official-source verification (SDCL + Secretary of State pages; automated research, quotes verbatim)";
const SOS = "South Dakota Secretary of State";
const LEG = "South Dakota Legislature (SDCL)";

export const SD_URLS = {
  fees: "https://sdsos.gov/Division%20of%20Business%20Services/Filing%20Fees/default.aspx",
  statute122: "https://sdlegislature.gov/api/Statutes/47-1A-122.html?all=true",
  statute212: "https://sdlegislature.gov/api/Statutes/47-34A-212.html?all=true",
  statute24: "https://sdlegislature.gov/api/Statutes/59-11-24.html?all=true",
  statute25: "https://sdlegislature.gov/api/Statutes/59-11-25.html?all=true",
  dissolutionCorp: "https://sdlegislature.gov/api/Statutes/47-1A-1420.html?all=true",
  dissolutionLlc: "https://sdlegislature.gov/api/Statutes/47-34A-809.html?all=true",
  pamphlet: "https://sdsos.gov/Business-Services/BusinessResources/BusinessResourcesDocs/pamphlet-domesticbusiness20170327.pdf",
  annualReport: "https://sosenterprise.sd.gov/BusinessServices/Business/AnnualReport.aspx",
  instructions: "https://sosenterprise.sd.gov/BusinessServices/Business/AnnualReportInstr.aspx",
  search: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = SOS): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

const COMMON: RuleSource[] = [
  src(
    "anniversary_month",
    SD_URLS.pamphlet,
    "Domestic business pamphlet (2017)",
    "Every domestic business corporation must file an Annual Report during the anniversary month of incorporation.",
  ),
  src(
    "subsequent_reports",
    SD_URLS.statute25,
    "SDCL 59-11-25",
    "The subsequent annual report shall be delivered to the Office of the Secretary of State by the same date each subsequent year.",
    LEG,
  ),
  src(
    "filing_date_2027",
    SD_URLS.statute25,
    "SDCL 59-11-25 (effective January 1, 2027)",
    "At the time of formation, an entity shall indicate on the formation document which filing date the entity has selected.",
    LEG,
  ),
  src("signer", SD_URLS.statute24, "SDCL 59-11-24", "Any other provisions of law notwithstanding, the annual report may be executed by any authorized person.", LEG),
  src(
    "agricultural_land",
    SD_URLS.statute24,
    "SDCL 59-11-24",
    "Whether the entity owns any agricultural land, as defined in § 43-2A-1, and, if so,",
    LEG,
  ),
  src("governors", SD_URLS.statute24, "SDCL 59-11-24", "The names and business addresses of its governors except:", LEG),
  src(
    "paper_fee",
    SD_URLS.instructions,
    "Annual Report instructions",
    "and then choose to print the Annual Report and mail it in with an additional $15 paper processing fee.",
  ),
  src("business_id", SD_URLS.annualReport, "Annual Report", "Please enter your Secretary of State Business ID and click \"Begin\"."),
];

interface SdProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  feeSource: RuleSource;
  lateSource: RuleSource;
  dissolutionSource: RuleSource;
  peopleLabel: string;
  peopleHelp: string;
  peopleTitles: string[];
}

const PROFILES: SdProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    feeSource: src("state_fee", SD_URLS.statute212, "SDCL 47-34A-212", "A reporting fee of fifty-five dollars, due and payable with the filing of each annual report.", LEG),
    lateSource: src(
      "late_fee",
      SD_URLS.statute212,
      "SDCL 47-34A-212",
      "is subject to a penalty of fifty-five dollars to be assessed by the secretary of state;",
      LEG,
    ),
    dissolutionSource: src("dissolution", SD_URLS.dissolutionLlc, "SDCL 47-34A-809", "Deliver its annual report to the secretary of state within sixty days after it is due.", LEG),
    peopleLabel: "Managers or members (governors)",
    peopleHelp: "List the LLC's managers, or its members if it has no managers, with a business address for each.",
    peopleTitles: ["Manager", "Member", "Managing Member"],
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "corporations",
    feeSource: src("state_fee", SD_URLS.statute122, "SDCL 47-1A-122", "Annual report, fifty-five dollars;", LEG),
    lateSource: src(
      "late_fee",
      SD_URLS.statute122,
      "SDCL 47-1A-122",
      "fifty-five dollars in addition to the annual report filing fee;",
      LEG,
    ),
    dissolutionSource: src(
      "dissolution",
      SD_URLS.dissolutionCorp,
      "SDCL 47-1A-1420",
      "The corporation does not deliver its annual report to the Office of the Secretary of State within sixty days",
      LEG,
    ),
    peopleLabel: "Directors and officers (governors)",
    peopleHelp: "List the corporation's directors and officers, with a business address for each.",
    peopleTitles: ["Director", "President", "Secretary", "Treasurer", "Vice President"],
  },
];

function intakeFor(p: SdProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your South Dakota business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "South Dakota Business ID",
            help: "Shown on South Dakota's business search. Leave blank if you don't have it.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          {
            key: "jurisdiction_of_formation",
            type: "text",
            label: "Jurisdiction of formation",
            help: "South Dakota, or the state or country where a foreign business was formed.",
            required: true,
            maxLength: 100,
          },
          {
            key: "filing_date_choice",
            type: "choice",
            label: "Which annual report date does your business use?",
            help: "From 2027, South Dakota lets a business file in its anniversary month or by January 31.",
            required: true,
            options: [
              { value: "anniversary", label: "Our anniversary month (the month we were formed)" },
              { value: "jan31", label: "January 31 each year" },
              { value: "unsure", label: "Not sure" },
            ],
            blocked: [
              { value: "jan31", message: "Filewell can't track the January 31 date yet. You can file this report yourself on South Dakota's site." },
            ],
          },
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        fields: [
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered agent address in South Dakota", required: true, noPoBox: true, lockedRegion: "SD" },
        ],
      },
      {
        key: "principal_office",
        title: "Principal office",
        fields: [{ key: "principal_office", type: "address", label: "Principal office address", required: true }],
      },
      {
        key: "people",
        title: "People",
        fields: [
          {
            key: "governors",
            type: "people",
            label: p.peopleLabel,
            help: p.peopleHelp,
            required: true,
            min: 1,
            max: 20,
            titleSuggestions: p.peopleTitles,
            withAddress: { label: "Business address", help: "Street, city, state and ZIP." },
          },
        ],
      },
      {
        key: "agricultural_land",
        title: "Agricultural land",
        fields: [
          {
            key: "owns_agricultural_land",
            type: "choice",
            label: "Does the business own any agricultural land?",
            help: "South Dakota's annual report asks this.",
            required: true,
            options: [
              { value: "no", label: "No" },
              { value: "yes", label: "Yes" },
            ],
            blocked: [
              {
                value: "yes",
                message: "Filewell can't file reports that list agricultural land yet. You can file this report yourself on South Dakota's site.",
              },
            ],
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
              { value: "unsure", label: "Not sure" },
            ],
          },
        ],
      },
    ],
  };
}

function buildRule(p: SdProfile): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = [
    { key: "late_fee", label: "Late annual report fee", cents: 5500, trigger: { kind: "filed_after_due_date" }, sourceFactKey: "late_fee" },
  ];
  return {
    ruleKey: `SD:annual_report:${p.entityType}`,
    stateCode: "SD",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-29): not sold. Open question sd_2027_filing_date keeps sales and filing closed.
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Annual Report",
    dueRule: { kind: "anniversary_month_end" },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 5500,
    nonprofitStateFeeCents: null,
    lateFeeCents: 5500,
    lateFees,
    // Filed during the anniversary month: the shortest month leaves 27 days before its last day.
    filingWindowDaysBefore: 27,
    lateFeeSummary: "South Dakota adds a $55 fee to an annual report not filed on time.",
    consequenceSummary:
      "A late report costs an extra $55. If it isn't filed within 60 days after it's due, South Dakota can administratively dissolve the business.",
    whoMustFile: `Every South Dakota ${p.noun} and every foreign ${p.noun} registered in South Dakota files an annual report each year.`,
    requiredInformation: [
      "Legal name, Business ID and jurisdiction of formation",
      "Registered agent and its South Dakota address",
      "Principal office address",
      `${p.peopleLabel}, with a business address for each`,
      "Whether the business owns agricultural land",
    ],
    intake: intakeFor(p),
    officialFilingUrl: SD_URLS.annualReport,
    officialInfoUrl: SD_URLS.instructions,
    filingMethodSummary:
      "Filed online on South Dakota's annual report tool with the Business ID (no account needed), signed by any authorized person, and paid by card.",
    processingSummary: "South Dakota files online annual reports when they're submitted.",
    customerSummary: `South Dakota ${p.pluralNoun} file an annual report in their anniversary month each year, with a $55 state fee. Filing late adds $55.`,
    faq: [
      {
        q: `When is a South Dakota ${p.noun}'s annual report due?`,
        a: "During the month the business was formed (its anniversary month), every year after the year it was formed. From 2027 a business can choose January 31 instead.",
      },
      { q: "How much is the state fee?", a: "$55 online, paid to the South Dakota Secretary of State. Our service fee, if you use us, is shown separately." },
      { q: "Is there a late fee?", a: "Yes. South Dakota adds $55 to a report that isn't filed on time." },
      { q: "Can I file it myself?", a: "Yes. You can file directly on South Dakota's site with your Business ID." },
    ],
    operatorRunbook: {
      portalName: "South Dakota Secretary of State business services",
      portalUrl: SD_URLS.annualReport,
      access: "No account. The business's Business ID opens the annual report.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Open the annual report tool and enter the Business ID. If the status is Dissolved or Revoked, stop and contact the customer.",
        "Pay the $55 late fee only if the order collected it; otherwise contact the customer first.",
        "Go through the screens and make every value match the packet. Answer no to agricultural land only if the packet says no.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "Sign as the customer's authorized person with your own name, pay by card and save the filed report.",
      ],
      fieldMap: [
        { section: "Start", portalField: "Business ID", answerKey: "entity_number" },
        { section: "Entity information", portalField: "Entity name", answerKey: "legal_name" },
        { section: "Entity information", portalField: "Jurisdiction", answerKey: "jurisdiction_of_formation" },
        { section: "Registered agent", portalField: "Registered agent", answerKey: "registered_agent_name" },
        { section: "Registered agent", portalField: "Registered agent address", answerKey: "registered_office" },
        { section: "Principal office", portalField: "Principal office address", answerKey: "principal_office" },
        { section: "Governors", portalField: "Names and business addresses", answerKey: "governors" },
        { section: "Agricultural land", portalField: "Owns agricultural land", answerKey: "owns_agricultural_land" },
        { section: "Signature", portalField: "Authorized person", answerKey: null, note: "Your own name as the customer's authorized filing agent, only after the comparison checkpoint." },
      ],
      confirmationLabel: "South Dakota filing number",
      receipt: "The filed annual report (PDF) from South Dakota's site.",
    },
    stateAuthorization: {
      certificationText: null,
      certificationSourceFactKey: "signer",
      operatorCheckpoint: true,
    },
    sources: [p.feeSource, p.lateSource, p.dissolutionSource, ...COMMON],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      "Not verified: how early South Dakota accepts a report (Filewell opens the month itself); the anniversary month in current Secretary wording (only a 2017 pamphlet says it); the 2025 session law itself. The Secretary's instructions page still says $50 late; statute and fee page say $55.",
  };
}

export const SOUTH_DAKOTA_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);
