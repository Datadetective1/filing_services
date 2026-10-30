import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeField, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Montana annual report (Secretary of State, Business Services).
 *
 * Checked 2026-10-29. Reports are filed between January 1 and April 15. The Secretary has
 * waived the fee for reports filed by April 15 in 2026 and says it will again in 2027; a
 * report filed after April 15 costs $35. The fee page calls the $35 neither a late fee nor a
 * penalty, only the fee after April 15, so Filewell shows it as the government fee for a late
 * filing. When the waiver ends (2028 at the latest), the on-time fee must be re-checked.
 *
 * Filing: a report with no changes needs no login on biz.sosmt.gov; changes need an account.
 * An LLC report is executed by "at least one member" or "the authorized agent" (MCA
 * 35-8-208). The customer signs it themselves (owner decision 2026-10-30): they must be one of
 * the people listed in the report, and the operator enters their name and title as the signer.
 * The signer also checks declaration boxes whose wording isn't published in text, so the
 * open question mt_declaration_text keeps filing closed until the wording is captured and
 * the customer has confirmed it.
 *
 * Launch scope: LLCs (domestic and foreign) and domestic for-profit corporations.
 */

const VERIFIED = "2026-10-29";
const REVIEWER = "Official-source verification (MCA + Secretary of State pages; automated research, quotes verbatim)";
const SOS = "Montana Secretary of State";
const LEG = "Montana Legislature (MCA)";

export const MT_URLS = {
  fees: "https://sosmt.gov/business/fees/",
  waiver: "https://sosmt.gov/secretary-christi-jacobsen-continues-montana-business-support-by-waiving-fees-once-again/",
  help: "https://help.sosmt.gov/en-us/article/how-do-i-file-my-annual-report-ywawrv/",
  llcStatute: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0080/part_0020/section_0080/0350-0080-0020-0080.html",
  llcDissolution: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0080/part_0020/section_0090/0350-0080-0020-0090.html",
  corpStatute: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0140/part_0160/section_0210/0350-0140-0160-0210.html",
  corpDissolution: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0140/part_0140/section_0200/0350-0140-0140-0200.html",
  portal: "https://biz.sosmt.gov/search/business",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = SOS): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

const COMMON: RuleSource[] = [
  src(
    "fee_waiver",
    MT_URLS.help,
    "How do I file my annual report?",
    "The Secretary of State's Office will waive the fee for all annual reports filed between January 1st and April 15th.",
  ),
  src("late_fee", MT_URLS.help, "How do I file my annual report?", "After April 15th, the fee is $35."),
  src(
    "waiver_2027",
    MT_URLS.waiver,
    "Secretary Christi Jacobsen continues Montana business support by waiving fees once again",
    "She also announced that it will be waived again in 2027, marking four consecutive years",
  ),
  src(
    "declarations",
    MT_URLS.help,
    "How do I file my annual report?",
    "To sign, read, and check each declaration box, and fill in all fields marked with a red asterisk.",
  ),
  src("no_login_path", MT_URLS.help, "How do I file my annual report?", "On the right-side panel, click the “File Annual Report” button."),
];

interface MtProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  appliesTo: ComplianceRuleDef["appliesTo"];
  feeQuote: string;
  sources: RuleSource[];
  peopleLabel: string;
  peopleHelp: string;
  peopleTitles: string[];
  extraFields: IntakeField[];
}

const PROFILES: MtProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    appliesTo: "domestic_and_foreign",
    feeQuote: "Annual Report Prior To April 15th | WAIVED",
    sources: [
      src(
        "due_date",
        MT_URLS.llcStatute,
        "MCA 35-8-208",
        "Subsequent annual reports must be delivered to the secretary of state between January 1 and April 15.",
        LEG,
      ),
      src(
        "signer",
        MT_URLS.llcStatute,
        "MCA 35-8-208",
        "The annual report must be executed by at least one member of the limited liability company or by the authorized agent.",
        LEG,
      ),
      src("dissolution", MT_URLS.llcDissolution, "MCA 35-8-209", "has failed for 140 days to file its annual report within the time required by law;", LEG),
    ],
    peopleLabel: "Managers or members",
    peopleHelp: "List the LLC's managers, or its members if it has no managers, with a business mailing address for each.",
    peopleTitles: ["Manager", "Member", "Managing Member"],
    extraFields: [],
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "corporations",
    appliesTo: "domestic",
    feeQuote: "Annual Report – Prior To April 15th | WAIVED",
    sources: [
      src(
        "due_date",
        MT_URLS.corpStatute,
        "MCA 35-14-1621",
        "Subsequent annual reports must be delivered to the secretary of state between January 1 and April 15 of subsequent years.",
        LEG,
      ),
      src(
        "signer",
        MT_URLS.corpStatute,
        "MCA 35-14-1621",
        "Information in the annual report must be current as of the date the annual report is signed on behalf of the corporation.",
        LEG,
      ),
      src("required_contents", MT_URLS.corpStatute, "MCA 35-14-1621", "a brief description of the nature of its business;", LEG),
      src(
        "dissolution",
        MT_URLS.corpDissolution,
        "MCA 35-14-1420",
        "the corporation does not deliver its annual report to the secretary of state within 120 days after it is due;",
        LEG,
      ),
    ],
    peopleLabel: "Directors and principal officers",
    peopleHelp: "List every director and principal officer, with a business address for each.",
    peopleTitles: ["Director", "President", "Secretary", "Treasurer", "Vice President"],
    extraFields: [
      { key: "nature_of_business", type: "text", label: "Brief description of the business", required: true, maxLength: 300 },
      {
        key: "shares_changed",
        type: "choice",
        label: "Have the corporation's authorized or issued shares changed since the last report?",
        required: true,
        options: [
          { value: "no", label: "No, keep the share numbers on record" },
          { value: "yes", label: "Yes" },
        ],
        blocked: [
          { value: "yes", message: "Filewell can't file share changes on a Montana report yet. You can file this report yourself on Montana's site." },
        ],
      },
    ],
  },
];

function intakeFor(p: MtProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Montana business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Montana business ID",
            help: "Shown on Montana's business search. Leave blank if you don't have it.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          ...p.extraFields,
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        fields: [
          {
            key: "registered_agent_change",
            type: "choice",
            label: "Is your registered agent changing with this report?",
            required: true,
            options: [
              { value: "no", label: "No: keep the registered agent on Montana's record" },
              { value: "new", label: "Yes, we're appointing a new registered agent" },
            ],
            blocked: [
              { value: "new", message: "Filewell can't file a registered agent change with a Montana report yet. You can file this report yourself on Montana's site." },
            ],
          },
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered office address in Montana", required: true, noPoBox: true, lockedRegion: "MT" },
        ],
      },
      {
        key: "principal_office",
        title: "Principal office",
        fields: [{ key: "principal_office", type: "address", label: "Principal office mailing address", required: true }],
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

function buildRule(p: MtProfile): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = [
    { key: "after_april_15_fee", label: "Annual report fee after April 15", cents: 3500, trigger: { kind: "filed_after_due_date" }, sourceFactKey: "late_fee" },
  ];
  return {
    ruleKey: `MT:annual_report:${p.entityType}`,
    stateCode: "MT",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: p.appliesTo,
    // v1 (2026-10-29). Since 2026-10-30 the customer signs (customerSignature); mt_declaration_text keeps filing closed.
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Annual Report",
    dueRule: { kind: "fixed_annual", month: 4, day: 15 },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 0,
    nonprofitStateFeeCents: null,
    lateFeeCents: 3500,
    lateFees,
    filingWindowDaysBefore: 104,
    lateFeeSummary: "Montana charges $35 for a report filed after April 15. Reports filed by April 15 are free in 2026 and 2027.",
    consequenceSummary:
      p.entityType === "llc"
        ? "A report filed after April 15 costs $35. An LLC that still hasn't filed after 140 days can be administratively dissolved."
        : "A report filed after April 15 costs $35. A corporation that hasn't filed within 120 days after it's due can be administratively dissolved.",
    whoMustFile:
      p.appliesTo === "domestic"
        ? `Every Montana ${p.noun} files an annual report each year, starting the year after it was formed.`
        : `Every Montana ${p.noun} and every foreign ${p.noun} registered in Montana files an annual report each year, starting the year after it was formed or registered.`,
    requiredInformation: [
      "Legal name and Montana business ID",
      "Registered agent and its Montana address",
      "Principal office mailing address",
      `${p.peopleLabel}, with a business address for each`,
      ...(p.entityType === "corporation" ? ["A brief description of the business, and its share numbers"] : []),
    ],
    intake: intakeFor(p),
    officialFilingUrl: MT_URLS.portal,
    officialInfoUrl: MT_URLS.help,
    filingMethodSummary:
      "Filed online at biz.sosmt.gov: search the business, choose File Annual Report, check each declaration box and sign. A report with changes needs a Montana business services account.",
    processingSummary: "Montana files online annual reports when they're submitted.",
    customerSummary: `Montana ${p.pluralNoun} file an annual report between January 1 and April 15. The state fee is waived through 2027 if you file on time; after April 15 it's $35.`,
    faq: [
      { q: `When is a Montana ${p.noun}'s annual report due?`, a: "Between January 1 and April 15 every year, starting the year after the business was formed." },
      { q: "How much is the state fee?", a: "Nothing in 2026 and 2027 if you file by April 15. After April 15 it's $35. Our service fee, if you use us, is shown separately." },
      { q: "Can I file it myself?", a: "Yes. You can file directly on Montana's business services site." },
    ],
    operatorRunbook: {
      portalName: "Montana Business Services (biz.sosmt.gov)",
      portalUrl: MT_URLS.portal,
      access: "No account for a report with no changes. Changes need Filewell's Montana business services login.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Search the business, open it and choose File Annual Report. Log in first if the packet changes anything.",
        "Pay the $35 fee only if the order collected it; otherwise contact the customer first.",
        "Make every value match the packet. Never change the registered agent or share numbers here.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "Signature: enter the customer's own name and title exactly as they signed in Filewell. Never sign with your own name.",
        "Check only the declarations the customer confirmed in Filewell, word for word. If a box reads differently, stop: the customer must confirm the new wording first. Then file online.",
      ],
      fieldMap: [
        { section: "Search", portalField: "Business name or ID", answerKey: "entity_number" },
        { section: "Entity information", portalField: "Entity name", answerKey: "legal_name" },
        ...(p.entityType === "corporation" ? [{ section: "Entity information", portalField: "Nature of business", answerKey: "nature_of_business" }] : []),
        { section: "Registered agent", portalField: "Registered agent", answerKey: "registered_agent_name", note: "Leave as on record" },
        { section: "Registered agent", portalField: "Registered office address", answerKey: "registered_office", note: "Leave as on record" },
        { section: "Principal office", portalField: "Principal office mailing address", answerKey: "principal_office" },
        { section: "People", portalField: "Names and business addresses", answerKey: "governors" },
        { section: "Signature", portalField: "Declarations, name and title", answerKey: null, note: "The customer's own name, title and confirmed declarations, only after the comparison checkpoint." },
      ],
      confirmationLabel: "Montana filing number",
      receipt: "The filed annual report (PDF) from Montana's site.",
    },
    stateAuthorization: {
      certificationText: null,
      certificationSourceFactKey: "declarations",
      operatorCheckpoint: true,
      customerSignature: { principalsKey: "governors", warnings: [], declarationsPending: true },
    },
    sources: [src("state_fee", MT_URLS.fees, "Business Services Filing Fees", p.feeQuote), ...p.sources, ...COMMON],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      "Fee waived on time in 2026 and 2027 only; re-check the on-time fee for 2028 (an older fee PDF listed $20). The declaration wording is not verified.",
  };
}

export const MONTANA_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);
