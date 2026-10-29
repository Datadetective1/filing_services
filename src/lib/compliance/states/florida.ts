import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Florida annual report (Department of State, Division of Corporations, "Sunbiz").
 *
 * Checked 2026-10-29. Every Florida LLC and profit corporation files between January 1 and
 * May 1. After May 1 Sunbiz charges a $400 late fee it says it cannot waive; non-profit
 * corporations are exempt. A business that still hasn't filed by the third Friday of
 * September is administratively dissolved or revoked.
 *
 * Signing: Sunbiz has no login (the document number opens the report), but the report must
 * be "signed" by one of the business's own principals typing their name. Sunbiz warns that
 * typing someone's name without their permission is forgery. So Filewell's operator never
 * signs as itself: the customer must be a listed principal and give explicit permission for
 * the name and title they sign with (StateAuthorization.principalSignature). Whether that
 * permission is enough is an open question for counsel (fl_signer_permission), so sales
 * and filing stay closed.
 *
 * Changing the registered agent needs the new agent's own electronic signature on the
 * report, so Filewell doesn't take registered agent changes here.
 *
 * Launch scope: LLCs and profit corporations only.
 */

const VERIFIED = "2026-10-29";
const REVIEWER = "Official-source verification (Sunbiz instructions + Florida Statutes; automated research, quotes verbatim)";
const DIV = "Florida Department of State, Division of Corporations";
const LEG = "Florida Legislature (Florida Statutes)";

export const FL_URLS = {
  annualReport: "https://dos.fl.gov/sunbiz/manage-business/efile/annual-report/",
  instructions: "https://efile.sunbiz.org/sbs_ar_instr.html",
  statute605_0212: "https://www.flsenate.gov/Laws/Statutes/2024/0605.0212",
  search: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName",
  info: "https://dos.fl.gov/sunbiz/",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = DIV): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

export const FL_FORGERY_WARNING = "Typing someone´s name/signature without their permission constitutes forgery.";
export const FL_FELONY_WARNING = "it is a 3rd Degree Felony to knowingly file a false document with the Division of Corporations.";

const COMMON: RuleSource[] = [
  src(
    "due_date",
    FL_URLS.annualReport,
    "Annual Report",
    "will have until 11:59 PM EST on Friday May 1, 2026, before a $400 late fee is assessed.",
  ),
  src("late_fee", FL_URLS.annualReport, "Annual Report", "A $400 late fee will be imposed on all profit corporations"),
  src("late_fee_no_waiver", FL_URLS.instructions, "Annual Report instructions", "There is no provision to abate or waive the $400 late fee."),
  src("late_fee_nonprofit", FL_URLS.instructions, "Annual Report instructions", "Not for profit corporations are not subject to the $400 late fee."),
  src("dissolution_deadline", FL_URLS.annualReport, "Annual Report", "If you do not file an annual report by the third Friday of September,"),
  src("dissolution", FL_URLS.annualReport, "Annual Report", "will be administratively dissolved or revoked in our records"),
  src("processing", FL_URLS.annualReport, "Annual Report", "Reports are processed and posted immediately."),
  src("principals", FL_URLS.instructions, "Annual Report instructions", "At least 1 principal must be provided."),
  src(
    "typed_signature",
    FL_URLS.instructions,
    "Annual Report instructions",
    "the typed name of the individual \"signing\" the document is sufficient under s.15.16, Florida Statutes.",
  ),
  src("forgery", FL_URLS.instructions, "Annual Report instructions", FL_FORGERY_WARNING),
  src("false_document", FL_URLS.instructions, "Annual Report instructions", FL_FELONY_WARNING),
  src(
    "ra_change_signature",
    FL_URLS.instructions,
    "Annual Report instructions",
    "the new registered agent must accept the designation by \"electronically signing\" the annual report.",
  ),
];

interface FlProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  stateFeeCents: number;
  feeQuote: string;
  peopleLabel: string;
  peopleHelp: string;
  peopleTitles: string[];
  extraSources: RuleSource[];
}

const PROFILES: FlProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    stateFeeCents: 13875,
    feeQuote: "Annual Report - Limited Liability Company $138.75",
    peopleLabel: "Managers or authorized members (principals)",
    peopleHelp: "List at least one person who has authority to manage the LLC, with their title and address. Include yourself if you will sign.",
    peopleTitles: ["Manager", "Managing Member", "Authorized Member", "Authorized Representative"],
    extraSources: [
      src(
        "first_report",
        FL_URLS.statute605_0212,
        "Florida Statutes 605.0212(3)",
        "The first annual report must be delivered to the department between January 1 and May 1",
        LEG,
      ),
      src(
        "subsequent_reports",
        FL_URLS.statute605_0212,
        "Florida Statutes 605.0212(3)",
        "Subsequent annual reports must be delivered to the department between January 1 and May 1 of each calendar year thereafter.",
        LEG,
      ),
      src(
        "required_contents",
        FL_URLS.statute605_0212,
        "Florida Statutes 605.0212(1)",
        "The name, title or capacity, and address of at least one person who has the authority to manage the company.",
        LEG,
      ),
      src(
        "fein",
        FL_URLS.statute605_0212,
        "Florida Statutes 605.0212(1)",
        "The company's federal employer identification number or, if none, whether one has been applied for.",
        LEG,
      ),
    ],
  },
  {
    entityType: "corporation",
    noun: "profit corporation",
    pluralNoun: "profit corporations",
    stateFeeCents: 15000,
    feeQuote: "Annual Report - Profit Corporation $150.00",
    peopleLabel: "Officers and directors (principals)",
    peopleHelp: "List the corporation's officers and directors with their title and address. Include yourself if you will sign.",
    peopleTitles: ["President", "Vice President", "Secretary", "Treasurer", "Director", "Chief Executive Officer"],
    extraSources: [],
  },
];

function intakeFor(p: FlProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Sunbiz record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Florida document number",
            help: "Shown on your Sunbiz record and on any letter from the Division of Corporations.",
            required: true,
            maxLength: 20,
            pattern: "^[A-Za-z0-9]{1,20}$",
            patternMessage: "Use letters and numbers only.",
          },
          {
            key: "fein_status",
            type: "choice",
            label: "Federal employer identification number (FEIN)",
            help: "Florida's report asks for the FEIN, or whether one has been applied for. Filewell doesn't collect the number itself.",
            required: true,
            options: [
              { value: "on_record", label: "Keep the FEIN already on our Sunbiz record" },
              { value: "applied_for", label: "We applied for one and don't have it yet" },
              { value: "none", label: "We don't have one and haven't applied" },
              { value: "change", label: "We need to add or change the FEIN" },
            ],
            blocked: [
              {
                value: "change",
                message: "Filewell can't add or change a FEIN on a Florida report yet. You can file this report yourself on Sunbiz.",
              },
            ],
          },
        ],
      },
      {
        key: "addresses",
        title: "Addresses",
        fields: [
          { key: "principal_office", type: "address", label: "Principal office street address", required: true, noPoBox: true },
          { key: "mailing_address", type: "address", label: "Mailing address", help: "Can be the same as the principal office.", required: true },
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        description: "Florida's report confirms the registered agent on record.",
        fields: [
          {
            key: "registered_agent_change",
            type: "choice",
            label: "Is your registered agent changing with this report?",
            required: true,
            options: [
              { value: "no", label: "No: keep the registered agent on our Sunbiz record" },
              { value: "new", label: "Yes, we're appointing a new registered agent" },
            ],
            blocked: [
              {
                value: "new",
                message:
                  "Florida needs the new registered agent to sign the annual report themselves, so Filewell can't file a registered agent change yet. You can file this report yourself on Sunbiz.",
              },
            ],
          },
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered agent address in Florida", required: true, noPoBox: true, lockedRegion: "FL" },
        ],
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
            withAddress: { label: "Address", help: "Street, city, state and ZIP." },
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
          {
            key: "state_notice_email",
            type: "email",
            label: "Email for Florida's annual report notices",
            help: "Sunbiz sends annual report reminders to this email.",
            required: false,
          },
        ],
      },
    ],
  };
}

function buildRule(p: FlProfile): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = [
    {
      key: "late_fee",
      label: "Late fee",
      cents: 40000,
      trigger: { kind: "filed_after_due_date" },
      exemptNonprofit: true,
      sourceFactKey: "late_fee",
    },
  ];
  return {
    ruleKey: `FL:annual_report:${p.entityType}`,
    stateCode: "FL",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-29): not sold. Open question fl_signer_permission keeps sales and filing closed.
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Annual Report",
    dueRule: { kind: "fixed_annual", month: 5, day: 1 },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: p.stateFeeCents,
    nonprofitStateFeeCents: null,
    lateFeeCents: 40000,
    lateFees,
    // January 1 to May 1.
    filingWindowDaysBefore: 120,
    lateFeeSummary: "Florida charges a $400 late fee on a report filed after May 1, and says it cannot waive it.",
    consequenceSummary:
      "A report filed after May 1 costs an extra $400. If it still isn't filed by the third Friday of September, Florida administratively dissolves the business (or revokes a foreign business's authority).",
    whoMustFile: `Every Florida ${p.noun} and every foreign ${p.noun} registered in Florida files an annual report each year, starting the year after it was formed or registered.`,
    requiredInformation: [
      "Legal name and Florida document number",
      "Federal employer identification number status",
      "Principal office and mailing address",
      "Registered agent and its Florida address",
      `${p.peopleLabel}, with a title and address for each`,
      "The name and title of the principal who signs",
    ],
    intake: intakeFor(p),
    officialFilingUrl: FL_URLS.annualReport,
    officialInfoUrl: FL_URLS.instructions,
    filingMethodSummary:
      "Filed online on Sunbiz with the business's document number (no account needed), signed by one of the business's principals typing their name, and paid by card.",
    processingSummary: "Sunbiz processes and posts annual reports filed online immediately.",
    customerSummary: `Florida ${p.pluralNoun} file an annual report between January 1 and May 1, with a $${(p.stateFeeCents / 100).toFixed(2)} state fee. Filing after May 1 adds a $400 late fee.`,
    faq: [
      {
        q: `When is a Florida ${p.noun}'s annual report due?`,
        a: "Between January 1 and May 1 every year, starting the year after the business was formed or registered in Florida.",
      },
      { q: "How much is the state fee?", a: `$${(p.stateFeeCents / 100).toFixed(2)}, paid to the Florida Division of Corporations. Our service fee, if you use us, is shown separately.` },
      { q: "Is there a late fee?", a: "Yes. Florida adds $400 to a report filed after May 1 and says it cannot waive it." },
      {
        q: "Who signs the report?",
        a: "One of the business's own principals (for example a manager or an officer). If we file for you, you sign our authorization as that principal and give us permission to type your name and title on the report.",
      },
      { q: "Can I file it myself?", a: "Yes. You can file directly on Sunbiz with your document number." },
    ],
    operatorRunbook: {
      portalName: "Sunbiz e-file (Florida Division of Corporations)",
      portalUrl: FL_URLS.annualReport,
      access: "No account. The business's document number opens the annual report.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "On Sunbiz, choose File Annual Report and enter the document number from the packet.",
        "If the business is already dissolved or the report is already filed this year, stop and contact the customer.",
        "Pay the $400 late fee only if the order collected it; otherwise contact the customer first.",
        "Go through the screens in the order below and make every value match the packet. Never change the registered agent.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "Signature block: type the signer's name and title exactly as the customer signed Filewell's authorization, and nothing else. Never type your own name or anyone else's.",
        "Pay by card and save the confirmation.",
      ],
      fieldMap: [
        { section: "Start", portalField: "Document number", answerKey: "entity_number" },
        { section: "Entity information", portalField: "Entity name", answerKey: "legal_name", note: "Check it matches; it can't be changed here" },
        { section: "Entity information", portalField: "FEI number", answerKey: "fein_status", note: "Leave the number on record, or tick applied for / not applicable as the packet says" },
        { section: "Entity information", portalField: "Principal place of business", answerKey: "principal_office" },
        { section: "Entity information", portalField: "Mailing address", answerKey: "mailing_address" },
        { section: "Registered agent", portalField: "Registered agent name and address", answerKey: "registered_agent_name", note: "Leave as on record" },
        { section: "Registered agent", portalField: "Registered agent Florida address", answerKey: "registered_office", note: "Leave as on record" },
        { section: "Email", portalField: "Email for annual report notices", answerKey: "state_notice_email" },
        { section: "Principals", portalField: "Name, title and address of each principal", answerKey: "governors", note: "Use Sunbiz's title abbreviations for the titles listed" },
        {
          section: "Signature",
          portalField: "Electronic signature (name and title)",
          answerKey: null,
          note: "The signer name and title from the customer's authorization, only after the comparison checkpoint.",
        },
      ],
      confirmationLabel: "Sunbiz confirmation / document number",
      receipt: "The Sunbiz confirmation page or email for the filed annual report.",
    },
    stateAuthorization: {
      certificationText: null,
      certificationSourceFactKey: "typed_signature",
      operatorCheckpoint: true,
      principalSignature: {
        principalsKey: "governors",
        warnings: [
          { text: FL_FORGERY_WARNING, sourceFactKey: "forgery" },
          { text: FL_FELONY_WARNING, sourceFactKey: "false_document" },
        ],
      },
    },
    sources: [src("state_fee", FL_URLS.annualReport, "Annual Report fees", p.feeQuote), ...COMMON, ...p.extraSources],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      "Florida's page gives May 1, 2026 (a Friday) as the 2026 deadline. Whether Sunbiz extends the deadline when May 1 falls on a weekend is not verified; Filewell keeps May 1. The corporation statute section for the late fee and the dissolution date were not re-read in this check.",
  };
}

export const FLORIDA_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

export const FLORIDA_FACTS = {
  businessSearchUrl: FL_URLS.search,
  portalUrl: FL_URLS.annualReport,
  lookupMethod: "manual" as const,
};
