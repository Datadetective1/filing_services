import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, RuleSource } from "../types";

/**
 * Pennsylvania Annual Report (DSCB:15-146) — Act 122 of 2022, 15 Pa.C.S. § 146.
 *
 * Every fact below was taken from an official Commonwealth source and independently
 * re-verified against that source by two separate reviewers on 2026-09-27.
 * Raw research and the verification log: docs/research/pa-research-raw.json and
 * docs/research/pa-verification-summary.json.
 *
 * To change a fact: add a NEW version (bump `version`, set a new `effectiveFrom`),
 * never edit a published one. Orders keep the version they were placed under.
 */

const VERIFIED = "2026-09-27";
const REVIEWER = "Two-reviewer source verification (automated research + adversarial check)";

const URL = {
  dosAnnualReports:
    "https://www.pa.gov/agencies/dos/programs/business/types-of-filings-and-registrations/annual-reports",
  dosFees: "https://www.pa.gov/agencies/dos/programs/business/fees-and-payments",
  dosScamAlerts: "https://www.pa.gov/agencies/dos/alerts-and-notices/business-and-charities-scams",
  dosNewsFilingWindow:
    "https://www.pa.gov/agencies/dos/newsroom/department-of-state-alerts-business-owners-about-new-annual-repo",
  form15146:
    "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/business/forms/15-146%20annual%20report%20final%2012.4.2024%20with%20watermark.pdf",
  howToFileGuide:
    "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/business/graphics/how%20to%20file%20an%20annual%20report.pdf",
  businessHubQuickAction: "https://hub.business.pa.gov/Home/QuickAction/882A08F5-EBEF-45C0-B804-6C53638D0094",
  statute146:
    "https://www.palegis.us/statutes/consolidated/view-statute?14&iFrame=true&txtType=HTM&ttl=15&div=00.&chpt=1&sctn=46&subsctn=0",
  statute153:
    "https://www.palegis.us/statutes/consolidated/view-statute?14&iFrame=true&txtType=HTM&ttl=15&div=00.&chpt=1&sctn=53&subsctn=0",
  statute381:
    "https://www.palegis.us/statutes/consolidated/view-statute?14&iFrame=true&txtType=HTM&ttl=15&div=00.&chpt=3&sctn=381&subsctn=0",
  statute419:
    "https://www.palegis.us/statutes/consolidated/view-statute?14&iFrame=true&txtType=HTM&ttl=15&div=00.&chpt=4&sctn=19&subsctn=0",
  onlineFiling: "https://file.dos.pa.gov/",
  businessSearch: "https://file.dos.pa.gov/search/business",
} as const;

export const PA_URLS = URL;

const DOS = "Pennsylvania Department of State";
const LEG = "Pennsylvania General Assembly";

function src(factKey: string, url: string, title: string, publisher: string, quote: string): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

const COMMON_SOURCES: RuleSource[] = [
  src(
    "filing_requirement",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Beginning in 2025, most domestic and foreign filing associations are required to file an Annual Report [DSCB:15-146].",
  ),
  src(
    "statutory_due_dates",
    URL.statute146,
    "15 Pa.C.S. § 146. Annual report",
    LEG,
    "(1) before July 1 in the case of a domestic or foreign corporation for profit or not-for-profit; (2) before October 1 in the case of a domestic or foreign limited liability company; and (3) on or before December 31 in the case of any other form of domestic or foreign association.",
  ),
  src(
    "required_contents",
    URL.statute146,
    "15 Pa.C.S. § 146. Annual report",
    LEG,
    "(1) its name and jurisdiction of formation; (2) ... the address of its registered office ... (3) the name of at least one governor;",
  ),
  src(
    "required_contents_2",
    URL.statute146,
    "15 Pa.C.S. § 146. Annual report",
    LEG,
    "(4) the names and titles of the persons who are its principal officers, if any, as determined by its governors; (5) the address of its principal office ... and (6) its entity number or similar identifier issued by the department.",
  ),
  src(
    "fee_schedule",
    URL.statute153,
    "15 Pa.C.S. § 153. Fee schedule",
    LEG,
    "(i) Annual report delivered to the bureau by a nonprofit corporation or a limited partnership or limited liability company with a not-for-profit purpose....... 0 (ii) Annual report delivered to the bureau electronically....... 7",
  ),
  src(
    "first_report_timing",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "A company’s first annual report is due the year following its formation in Pennsylvania or its initial foreign registration.",
  ),
  src(
    "filing_window",
    URL.dosNewsFilingWindow,
    "Department of State Alerts Business Owners About New Annual Report Requirement Starting in 2025",
    DOS,
    "The filing window is based on the entity type: corporations Jan. 1 – June 30; limited liability companies Jan. 1 – Sept. 30; and all others Jan. 1 – Dec. 31.",
  ),
  src(
    "no_late_fee",
    URL.dosScamAlerts,
    "Business and Charities Scam Alerts",
    DOS,
    "There is no state late fee for filing past the deadline",
  ),
  src(
    "enforcement_start",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Beginning with Annual Reports due in 2027, associations that fail to file annual reports in the 2027 calendar year will be subject to administrative dissolution/termination/cancellation six months after the due date of the Annual Report.",
  ),
  src(
    "consequence_types",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Failure to file the annual report will subject the association to (i) administrative dissolution if it is a domestic filing entity, (ii) administrative cancellation if it is a domestic limited liability partnership; or (iii) administrative termination of its registration if it is a foreign association",
  ),
  src(
    "statutory_enforcement_date",
    URL.statute381,
    "15 Pa.C.S. § 381. Grounds for administrative dissolution or cancellation",
    LEG,
    "if the entity does not deliver an annual report to the department within six months after the annual report is due. (b) Transitional provision.--Subsection (a) applies with respect to annual reports due on or after January 4, 2027.",
  ),
  src(
    "online_filing",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "The Annual Report [DSCB:15-146] should be filed online at file.dos.pa.gov.",
  ),
  src(
    "online_filing_steps",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Log in to https://file.dos.pa.gov Search for the company name under Business Search Click on “File Annual Report” icon (no PIN access required) Confirm/update your entity information Pay the $7 fee (no fee for nonprofits)",
  ),
  src(
    "processing",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Annual Reports submitted online will be automatically approved. Online filers see statuses in real time and will be able to access the approved Annual Report within minutes.",
  ),
  src(
    "document_retention",
    URL.businessHubQuickAction,
    "File an Annual Report (PA Business Hub)",
    DOS,
    "Documents in Business Filing Services are only available for 60 days after processing.",
  ),
  src(
    "no_financial_info",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Is any financial information required on the annual report? No.",
  ),
  src(
    "registered_office",
    URL.form15146,
    "Annual Report, DSCB:15-146 (form and instructions)",
    DOS,
    "This address must be in Pennsylvania. Give one of the following: (a) the registered office address in the Commonwealth or (b) the name of a Commercial Registered Office Provider and the county of venue.",
  ),
  src(
    "no_po_box",
    URL.form15146,
    "Annual Report, DSCB:15-146 (form and instructions)",
    DOS,
    "the Department of State is required to refuse to receive or file any document that sets forth only a post office box address.",
  ),
  src(
    "principal_office",
    URL.form15146,
    "Annual Report, DSCB:15-146 (form and instructions)",
    DOS,
    "An association's principal office is where the association performs its primary executive functions, whether or not the office is located within the Commonwealth of Pennsylvania.",
  ),
  src(
    "signature",
    URL.form15146,
    "Annual Report, DSCB:15-146 (form and instructions)",
    DOS,
    "The Annual Report must be signed by an authorized representative of the association.",
  ),
  src(
    "third_party_filing",
    URL.dosScamAlerts,
    "Business and Charities Scam Alerts",
    DOS,
    "While Annual Reports may be submitted on behalf of businesses by law firms and legitimate service companies",
  ),
];

function feeSources(entityType: EntityType): RuleSource[] {
  const standard = src(
    "state_fee",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "The fee is $7 for business corporations, limited liability companies (LLCs), limited partnerships (LPs) and limited liability general partnerships (LLPs).",
  );
  if (entityType === "nonprofit_corporation" || entityType === "llc" || entityType === "lp") {
    const nonprofit = src(
      "state_fee_nonprofit",
      URL.dosAnnualReports,
      "Annual Reports",
      DOS,
      "There is no fee for nonprofit corporations and any LPs or LLCs with a not-for-profit purpose.",
    );
    return entityType === "nonprofit_corporation" ? [{ ...nonprofit, factKey: "state_fee" }] : [standard, nonprofit];
  }
  return [standard];
}

function dueSource(entityType: EntityType): RuleSource {
  if (entityType === "corporation" || entityType === "nonprofit_corporation") {
    return src(
      "due_date",
      URL.dosAnnualReports,
      "Annual Reports",
      DOS,
      "For all corporations (business and nonprofit, domestic and foreign), the deadline is June 30 of each year.",
    );
  }
  return src(
    "due_date",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "The deadline for limited liability companies (domestic and foreign) is September 30, and the annual report of any other domestic filing entity or foreign filing association is due on or before December 31 of each year.",
  );
}

interface EntityProfile {
  entityType: EntityType;
  noun: string; // "LLC"
  pluralNoun: string; // "LLCs"
  due: { month: number; day: number };
  dueText: string; // "September 30"
  stateFeeCents: number;
  nonprofitStateFeeCents: number | null;
  governorLabel: string;
  /** Singular noun phrase for "at least one ___". */
  governorSingular: string;
  governorHelp: string;
  governorTitles: string[];
  officersMin: number;
  officerHelp: string;
  officerTitles: string[];
  carNote?: string;
}

const PROFILES: EntityProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    due: { month: 9, day: 30 },
    dueText: "September 30",
    stateFeeCents: 700,
    nonprofitStateFeeCents: 0,
    governorLabel: "Managers or managing members",
    governorSingular: "manager or managing member",
    governorHelp:
      "List at least one: a manager (if the LLC is manager-managed) or a member who has the right to participate materially in management (if member-managed).",
    governorTitles: ["Member", "Managing Member", "Manager"],
    officersMin: 0,
    officerHelp: "Only if your LLC has principal officers (for example, a CEO or treasurer). Leave empty if it doesn't.",
    officerTitles: ["Chief Executive Officer", "President", "Treasurer", "Secretary"],
    carNote:
      "Restricted professional companies (PLLCs) must also file the separate Certificate of Annual Registration by April 15.",
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "business corporations",
    due: { month: 6, day: 30 },
    dueText: "June 30",
    stateFeeCents: 700,
    nonprofitStateFeeCents: null,
    governorLabel: "Directors",
    governorSingular: "director",
    governorHelp: "List at least one director. Directors of a corporation must be natural persons.",
    governorTitles: ["Director"],
    officersMin: 1,
    officerHelp:
      "Pennsylvania corporations have a president, a secretary and a treasurer (or people who act as such). One person may hold more than one office.",
    officerTitles: ["President", "Secretary", "Treasurer", "Vice President", "Chief Executive Officer"],
  },
  {
    entityType: "nonprofit_corporation",
    noun: "nonprofit corporation",
    pluralNoun: "nonprofit corporations",
    due: { month: 6, day: 30 },
    dueText: "June 30",
    stateFeeCents: 0,
    nonprofitStateFeeCents: 0,
    governorLabel: "Directors",
    governorSingular: "director",
    governorHelp:
      "List at least one director (or a member of another body that performs the functions of a board of directors).",
    governorTitles: ["Director", "Trustee"],
    officersMin: 1,
    officerHelp:
      "Pennsylvania nonprofit corporations have a president, a secretary and a treasurer (or people who act as such).",
    officerTitles: ["President", "Secretary", "Treasurer", "Vice President", "Executive Director"],
  },
  {
    entityType: "lp",
    noun: "limited partnership",
    pluralNoun: "limited partnerships (including LLLPs)",
    due: { month: 12, day: 31 },
    dueText: "December 31",
    stateFeeCents: 700,
    nonprofitStateFeeCents: 0,
    governorLabel: "General partners",
    governorSingular: "general partner",
    governorHelp: "List at least one general partner. A general partner may be a person or a company.",
    governorTitles: ["General Partner"],
    officersMin: 0,
    officerHelp: "Only if the partnership has principal officers. Leave empty if it doesn't.",
    officerTitles: ["President", "Treasurer"],
    carNote: "LLLPs must also file the separate Certificate of Annual Registration by April 15.",
  },
  {
    entityType: "llp",
    noun: "limited liability partnership",
    pluralNoun: "limited liability (general) partnerships",
    due: { month: 12, day: 31 },
    dueText: "December 31",
    stateFeeCents: 700,
    nonprofitStateFeeCents: null,
    governorLabel: "Partners",
    governorSingular: "partner",
    governorHelp: "List at least one partner.",
    governorTitles: ["Partner", "Managing Partner"],
    officersMin: 0,
    officerHelp: "Only if the partnership has principal officers. Leave empty if it doesn't.",
    officerTitles: ["Managing Partner", "Treasurer"],
    carNote: "LLPs must also file the separate Certificate of Annual Registration by April 15.",
  },
  {
    entityType: "electing_partnership",
    noun: "electing partnership",
    pluralNoun: "electing partnerships",
    due: { month: 12, day: 31 },
    dueText: "December 31",
    stateFeeCents: 700,
    nonprofitStateFeeCents: null,
    governorLabel: "General partners",
    governorSingular: "general partner",
    governorHelp: "List at least one general partner.",
    governorTitles: ["General Partner"],
    officersMin: 0,
    officerHelp: "Only if the partnership has principal officers. Leave empty if it doesn't.",
    officerTitles: ["Managing Partner", "Treasurer"],
  },
  {
    entityType: "professional_association",
    noun: "professional association",
    pluralNoun: "professional associations",
    due: { month: 12, day: 31 },
    dueText: "December 31",
    stateFeeCents: 700,
    nonprofitStateFeeCents: null,
    governorLabel: "Members of the board of governors",
    governorSingular: "member of the board of governors",
    governorHelp: "List at least one member of the board of governors.",
    governorTitles: ["Governor", "Board Member"],
    officersMin: 0,
    officerHelp: "Only if the association has principal officers. Leave empty if it doesn't.",
    officerTitles: ["President", "Secretary", "Treasurer"],
  },
  {
    entityType: "business_trust",
    noun: "business trust",
    pluralNoun: "business trusts",
    due: { month: 12, day: 31 },
    dueText: "December 31",
    stateFeeCents: 700,
    nonprofitStateFeeCents: null,
    governorLabel: "Trustees",
    governorSingular: "trustee",
    governorHelp: "List at least one trustee.",
    governorTitles: ["Trustee"],
    officersMin: 0,
    officerHelp: "Only if the trust has principal officers. Leave empty if it doesn't.",
    officerTitles: ["President", "Treasurer"],
  },
];

function intakeFor(p: EntityProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Pennsylvania business record.",
        fields: [
          {
            key: "legal_name",
            type: "text",
            label: "Legal name",
            required: true,
            maxLength: 300,
          },
          {
            key: "entity_number",
            type: "text",
            label: "Pennsylvania entity number",
            help: "Shown on the official Pennsylvania business search. If you don't have it, leave it blank and we'll look it up on the public record.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          {
            key: "jurisdiction_of_formation",
            type: "text",
            label: "Jurisdiction of formation",
            help: "Pennsylvania, or the state or country where a foreign entity was formed.",
            required: true,
            maxLength: 100,
          },
        ],
      },
      {
        key: "registered_office",
        title: "Registered office",
        description:
          "Pennsylvania requires either a street address in Pennsylvania or the name of a commercial registered office provider (CROP) and the county.",
        fields: [
          {
            key: "registered_office",
            type: "registered_office",
            label: "Registered office",
            required: true,
            region: "PA",
          },
        ],
      },
      {
        key: "principal_office",
        title: "Principal office",
        description:
          "Where the business performs its primary executive functions. It can be outside Pennsylvania. P.O. boxes alone are not accepted.",
        fields: [
          {
            key: "principal_office",
            type: "address",
            label: "Principal office address",
            required: true,
            noPoBox: true,
          },
        ],
      },
      {
        key: "people",
        title: "People",
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
          {
            key: "principal_officers",
            type: "people",
            label: "Principal officers",
            help: p.officerHelp,
            required: p.officersMin > 0,
            min: p.officersMin,
            max: 20,
            titleSuggestions: p.officerTitles,
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
            label: "Has any of this information changed since your last filing?",
            required: false,
            options: [
              { value: "no", label: "No changes" },
              { value: "yes", label: "Yes, something changed" },
              { value: "first", label: "This is our first annual report" },
              { value: "unsure", label: "Not sure" },
            ],
          },
          {
            key: "state_notice_email",
            type: "email",
            label: "Email for Pennsylvania's annual report notices (optional)",
            help: "The Department of State can send courtesy notices to an email address on file for your business.",
            required: false,
          },
        ],
      },
    ],
  };
}

function buildRule(p: EntityProfile): ComplianceRuleDef {
  const fee = p.stateFeeCents === 0 ? "no state fee" : `a $${(p.stateFeeCents / 100).toFixed(0)} state fee`;
  const nonprofitClause =
    p.nonprofitStateFeeCents === 0 && p.stateFeeCents > 0
      ? ` There is no fee for ${p.pluralNoun === "LLCs" ? "LLCs" : "LPs"} with a not-for-profit purpose.`
      : "";

  const faq = [
    {
      q: `When is the Pennsylvania ${p.noun} annual report due?`,
      a: `By ${p.dueText} each year. The filing window opens January 1 of the report year.`,
    },
    {
      q: "How much is the state fee?",
      a:
        p.stateFeeCents === 0
          ? "There is no state fee for nonprofit corporations."
          : `The Department of State charges $7.${nonprofitClause} If you have us file it, our service fee is shown separately before you pay.`,
    },
    {
      q: "Can I file it myself?",
      a: "Yes. You can file directly with the Pennsylvania Department of State at file.dos.pa.gov. Online filings are approved automatically, usually within minutes. Using a filing service is optional.",
    },
    {
      q: "Is there a late fee?",
      a: "The Department of State says there is no state late fee for filing after the deadline. Beginning with reports due in 2027, entities that don't file become subject to administrative dissolution, cancellation or termination six months after the due date.",
    },
    {
      q: "My business was formed this year. Do I need to file?",
      a: "No. The first annual report is due in the calendar year after a business forms in Pennsylvania or first registers as a foreign entity.",
    },
    {
      q: "Does the report include financial information?",
      a: "No. It confirms your business's name, registered office, principal office, and the names of its governors and principal officers.",
    },
    ...(p.carNote
      ? [
          {
            q: "Does the annual report replace the Certificate of Annual Registration?",
            a: `No. ${p.carNote}`,
          },
        ]
      : []),
  ];

  return {
    ruleKey: `PA:annual_report:${p.entityType}`,
    stateCode: "PA",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: "2025-01-01",
    filingName: "Annual Report",
    formNumber: "DSCB:15-146",
    dueRule: { kind: "fixed_annual", month: p.due.month, day: p.due.day },
    firstDueRule: { kind: "year_after_formation" },
    firstRequiredYear: 2025,
    stateFeeCents: p.stateFeeCents,
    nonprofitStateFeeCents: p.nonprofitStateFeeCents,
    lateFeeCents: null,
    lateFeeSummary: "Pennsylvania does not charge a state late fee for filing after the deadline.",
    consequenceSummary:
      "Beginning with reports due in 2027, an entity that doesn't file becomes subject to administrative dissolution (domestic entities), cancellation (domestic LLPs) or termination of its registration (foreign entities) six months after the due date. Reports due in 2025 and 2026 fall in a transition period.",
    whoMustFile: `Every active domestic and foreign ${p.noun} registered with the Pennsylvania Department of State. A business files its first report in the calendar year after it forms or registers in Pennsylvania.`,
    requiredInformation: [
      "Legal name and jurisdiction of formation",
      "Pennsylvania entity number",
      "Registered office in Pennsylvania, or a commercial registered office provider (CROP) and county",
      `The name of at least one ${p.governorSingular}`,
      p.officersMin > 0 ? "Names and titles of principal officers" : "Names and titles of principal officers, if any",
      "Principal office address (may be outside Pennsylvania; no P.O. boxes)",
    ],
    intake: intakeFor(p),
    officialFilingUrl: URL.onlineFiling,
    officialInfoUrl: URL.dosAnnualReports,
    filingMethodSummary:
      "Filed online through the Department of State's Business Filing Services (file.dos.pa.gov): log in, find the business with Business Search, choose “File Annual Report”, confirm or update the information, e-sign and pay. A paper form (DSCB:15-146) may also be mailed.",
    processingSummary:
      "Online filings are approved automatically, usually within minutes. The filed report is available in the state portal for 60 days after processing.",
    customerSummary: `Pennsylvania ${p.pluralNoun} must file an annual report with the Department of State by ${p.dueText} each year, with ${fee}.${nonprofitClause}`,
    faq,
    sources: [dueSource(p.entityType), ...feeSources(p.entityType), ...COMMON_SOURCES],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      p.nonprofitStateFeeCents === null && p.stateFeeCents > 0
        ? "Form DSCB:15-146 lists a $0 fee for other associations with a not-for-profit purpose; the statute names only nonprofit corporations, LPs and LLCs. Charge $7 and have an operator confirm if the customer indicates a not-for-profit purpose."
        : undefined,
  };
}

export const PENNSYLVANIA_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

/**
 * Facts that apply to every Pennsylvania annual report, used on the state pages.
 * Each maps to a source above.
 */
export const PENNSYLVANIA_FACTS = {
  directFilingFeeText: "$7 ($0 for nonprofits)",
  noLateFee: true,
  enforcementStartsWithReportsDueIn: 2027,
  firstRequiredYear: 2025,
  documentRetentionDays: 60,
  officialFilingUrl: URL.onlineFiling,
  officialInfoUrl: URL.dosAnnualReports,
  businessSearchUrl: URL.businessSearch,
  exemptTypes:
    "Fictitious names, general partnerships that are not LLPs, authorities, name reservations and registrations, land banks, financial institutions and credit unions, trademarks, and entities with an inactive status do not file annual reports.",
  exemptSource: src(
    "exempt_types",
    URL.dosAnnualReports,
    "Annual Reports",
    DOS,
    "Filing types that are not required to make Annual Reports are: fictitious names, general partnerships that are not limited liability partnerships, authorities (all subtypes), name reservations, land banks, financial institutions and credit unions",
  ),
} as const;
