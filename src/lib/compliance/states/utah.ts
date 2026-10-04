import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Utah annual report / renewal (Division of Corporations and Commercial Code).
 *
 * Checked 2026-10-01, the day 2026 S.B. 40 took effect. S.B. 40 replaced the per-type
 * annual report sections with Utah Code 16-1a-212: reports are due "on the last day of
 * the anniversary month" and may be delivered up to 60 days before. Fees come from the
 * Division's current fee schedule (FY2026, effective July 1, 2025) and renewal coupon.
 *
 * Late fee: the Division's fee schedule lists a $10 late renewal fee and the coupon
 * applies it to corporations, nonprofits, LLCs, LPs/LLLPs and LLPs (N/A for business
 * trusts). The Division hasn't published how S.B. 40 changes the day it starts charging,
 * so Filewell treats it as applying only when the Division's own record shows the
 * renewal as delinquent; an operator confirms the amount in the state portal.
 *
 * Public data: the entity search is behind a Cloudflare challenge and opendata.utah.gov
 * is decommissioned; bulk lists are paid. Filewell does not automate the search.
 */

const VERIFIED = "2026-10-01";
const VERIFIED_V2 = "2026-10-04";
const REVIEWER = "Official-source verification (Utah Code + Division fee schedule; automated research, quotes verbatim)";
const DIV = "Utah Division of Corporations and Commercial Code";
const LEG = "Utah Legislature (Utah Code)";

export const UT_URLS = {
  statute212: "https://le.utah.gov/xcode/Title16/Chapter1A/C16-1a_2026050620261001.pdf",
  sb40: "https://le.utah.gov/Session/2026/bills/enrolled/SB0040.pdf",
  feeSchedule: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
  coupon: "https://commerce.utah.gov/wp-content/uploads/2021/10/renewal.pdf",
  renewalProcess: "https://commerce.utah.gov/corporations/renewal-process/",
  registration: "https://businessregistration.utah.gov/",
  onlineInstructions: "https://commerce.utah.gov/corporations/online-registration-instructions/",
  mailerAdvisory: "https://commerce.utah.gov/2025/07/01/advisory-for-business-registrants-important-mail-alert-2/",
  info: "https://commerce.utah.gov/corporations/",
  renewalGuide: "https://commerce.utah.gov/wp-content/uploads/2025/01/Renewal-WO-Changes.pdf",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = DIV): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

const COMMON: RuleSource[] = [
  src(
    "due_date",
    UT_URLS.statute212,
    "Utah Code 16-1a-212(5) (effective October 1, 2026)",
    "shall deliver an annual report to the division each calendar year on the last day of the anniversary month; and (ii) may deliver the annual report up to 60 days before the last day of the anniversary month",
    LEG,
  ),
  src(
    "anniversary_month",
    UT_URLS.statute212,
    "Utah Code 16-1a-212(1)",
    "the calendar month in which: (a) a domestic filing entity's formation becomes effective with the division; or (b) a registered foreign entity's application for authority ... takes effect",
    LEG,
  ),
  src(
    "required_contents",
    UT_URLS.statute212,
    "Utah Code 16-1a-212(2)",
    "the name and address of each director and principal officer",
    LEG,
  ),
  src(
    "dissolution",
    UT_URLS.statute212,
    "Utah Code 16-1a-602(2)",
    "deliver to the division for filing an annual report not later than 60 days after the day on which the the annual report is due",
    LEG,
  ),
  src("late_fee", UT_URLS.feeSchedule, "Fee Schedule (FY2026)", "Late renewal fee $10"),
  src(
    "reinstatement",
    UT_URLS.feeSchedule,
    "Fee Schedule (FY2026)",
    "Reinstatement filings incur a $18 charge for each year the renewal/annual report filing was missed, in addition to a $10 delinquency fee.",
  ),
  src("utahid", UT_URLS.renewalProcess, "Renewal process", "All users must have a UtahID to login."),
  src(
    "filing_authority",
    UT_URLS.onlineInstructions,
    "Online registration instructions",
    "Filing Authority is an optional security feature that allows users to register an administrator for an entity, allowing only the administrator and their designated users to file on a business.",
  ),
  src("nonrefundable", UT_URLS.feeSchedule, "Fee Schedule (FY2026)", "ALL PROCESSING FEES ARE NONREFUNDABLE"),
];

interface UtProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  feeQuote: string;
  lateFee: boolean;
  peopleLabel: string;
  peopleHelp: string;
  peopleTitles: string[];
}

const PROFILES: UtProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    feeQuote: "*Domestic/foreign LLC ... $18",
    lateFee: true,
    peopleLabel: "Managers or members (principals)",
    peopleHelp: "List the LLC's managers, or its members if it has no managers, with an address for each.",
    peopleTitles: ["Manager", "Member", "Managing Member"],
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "corporations",
    feeQuote: "*Domestic/foreign corporation ... $18",
    lateFee: true,
    peopleLabel: "Directors and principal officers",
    peopleHelp: "List every director and principal officer (for example president, secretary, treasurer), with an address for each.",
    peopleTitles: ["Director", "President", "Secretary", "Treasurer", "Vice President"],
  },
  {
    entityType: "lp",
    noun: "limited partnership",
    pluralNoun: "limited partnerships (including LLLPs)",
    feeQuote: "*Domestic/foreign LP and LLLP ... $18",
    lateFee: true,
    peopleLabel: "General partners",
    peopleHelp: "List every general partner, with an address for each.",
    peopleTitles: ["General Partner"],
  },
  {
    entityType: "llp",
    noun: "limited liability partnership",
    pluralNoun: "limited liability partnerships",
    feeQuote: "*Domestic/foreign LLP ... $18",
    lateFee: true,
    peopleLabel: "Partners",
    peopleHelp: "List the partnership's partners or managing partners, with an address for each.",
    peopleTitles: ["Partner", "Managing Partner"],
  },
  {
    entityType: "business_trust",
    noun: "business trust",
    pluralNoun: "business trusts",
    feeQuote: "Business trust ... $18",
    lateFee: false,
    peopleLabel: "Trustees",
    peopleHelp: "List every trustee, with an address for each.",
    peopleTitles: ["Trustee"],
  },
];

function intakeFor(p: UtProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Utah business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Utah entity number",
            help: "Shown on your renewal notice and on Utah's business entity search. Leave blank if you don't have it.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          {
            key: "jurisdiction_of_formation",
            type: "text",
            label: "Jurisdiction of formation",
            help: "Utah, or the state or country where a foreign entity was formed.",
            required: true,
            maxLength: 100,
          },
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        description: "Utah's annual report confirms the registered agent. Changing it during renewal is free.",
        fields: [
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered agent address in Utah", required: true, noPoBox: true, lockedRegion: "UT" },
        ],
      },
      {
        key: "principal_office",
        title: "Principal office",
        fields: [{ key: "principal_office", type: "address", label: "Principal office street address", required: true, noPoBox: true }],
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
            label: "Has any of this changed since your last renewal?",
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
            label: "Email for Utah's annual report notices",
            help: "Utah uses this email for annual report notices.",
            required: false,
          },
        ],
      },
    ],
  };
}

function buildRule(p: UtProfile): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = p.lateFee
    ? [{ key: "late_renewal_fee", label: "Late renewal fee", cents: 1000, trigger: { kind: "state_status", statuses: ["Delinquent"] }, sourceFactKey: "late_fee" }]
    : [];
  return {
    ruleKey: `UT:annual_report:${p.entityType}`,
    stateCode: "UT",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-01) never took an order. v2 adds the customer's packet confirmation, the
    // portal-order packet (Division user guides, 2025) and the operator checkpoint. S.B. 40
    // operations stay open questions (compliance/open-questions): sales and filing fail closed.
    version: 2,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED_V2,
    filingName: "Annual Report/Renewal",
    dueRule: { kind: "anniversary_month_end" },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 1800,
    nonprofitStateFeeCents: null,
    lateFeeCents: p.lateFee ? 1000 : null,
    lateFees,
    filingWindowDaysBefore: 60,
    lateFeeSummary: p.lateFee
      ? "Utah's fee schedule lists a $10 late renewal fee for a renewal that is overdue."
      : "Utah's renewal coupon lists no late fee for business trusts.",
    consequenceSummary:
      "If the annual report isn't filed within 60 days after it's due, the Division may begin administrative dissolution (or termination of a foreign entity's registration), with a further 60 days to cure after notice. Reinstatement costs $18 for each missed year plus a $10 delinquency fee.",
    whoMustFile: `Every Utah ${p.noun} and every foreign ${p.noun} registered in Utah files an annual report each year.`,
    requiredInformation: [
      "Legal name, entity number and jurisdiction of formation",
      "Registered agent and its Utah address",
      "Principal office street address",
      `${p.peopleLabel}, with an address for each`,
    ],
    intake: intakeFor(p),
    officialFilingUrl: UT_URLS.registration,
    officialInfoUrl: UT_URLS.renewalProcess,
    filingMethodSummary:
      "Filed online in Utah's Business Registration System (businessregistration.utah.gov) with a UtahID: Renewals, Annual Report/Renewal with or without changes, sign, then pay by card. Entities with Filing Authority turned on can only be renewed by their administrator or designated users.",
    processingSummary: "The Division processes renewals in about 7 to 10 business days and delivers an acknowledgment of the filing.",
    customerSummary: `Utah ${p.pluralNoun} file an annual report by the last day of their anniversary month, with an $18 state fee.${p.lateFee ? " A $10 late renewal fee can apply when the renewal is overdue." : ""}`,
    faq: [
      {
        q: `When is a Utah ${p.noun}'s annual report due?`,
        a: "By the last day of the month in which the entity was formed in Utah (or registered, for a foreign entity), every year. Utah accepts it up to 60 days before.",
      },
      { q: "How much is the state fee?", a: "$18, paid to the Utah Division of Corporations. Our service fee, if you use us, is shown separately." },
      {
        q: "Is there a late fee?",
        a: p.lateFee ? "Utah lists a $10 late renewal fee for overdue renewals." : "Utah's renewal coupon lists no late fee for business trusts.",
      },
      { q: "Can I file it myself?", a: "Yes. You can renew directly with the Utah Division of Corporations online using a UtahID." },
    ],
    operatorRunbook: {
      portalName: "Utah Business Registration System",
      portalUrl: UT_URLS.registration,
      access:
        "A UtahID login (required for all users). Entities formed after September 16, 2024 have Filing Authority on: the entity's administrator must add Filewell's UtahID as a designated user before Filewell can renew. Older entities without an administrator can be renewed by any logged-in user.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Sign in with Filewell's UtahID at businessregistration.utah.gov.",
        "Renewals > Annual Report/Renewal with changes (or without changes, if the packet changes nothing); search the entity by number.",
        "If Filing Authority blocks you, stop and ask the customer to add Filewell as a designated user.",
        "Check the renewal status. Pay a $10 late fee only if the order collected it; otherwise contact the customer first.",
        "Go through the screens in the order below and make every value match the packet.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "Signature page: tick the attestation, authorization and acknowledgement boxes, type your name and select the title agreed for an authorized agent. Pay by card and save the acknowledgment.",
      ],
      fieldMap: [
        { section: "Entity search", portalField: "Entity number", answerKey: "entity_number" },
        { section: "Entity search", portalField: "Entity name", answerKey: "legal_name" },
        { section: "Purpose statement", portalField: "Purpose (optional)", answerKey: null, note: "Leave as on record" },
        { section: "Principal office", portalField: "Principal office street address", answerKey: "principal_office" },
        { section: "Principal office", portalField: "Email (annual report notices)", answerKey: "state_notice_email" },
        { section: "Registered agent", portalField: "Registered agent", answerKey: "registered_agent_name" },
        { section: "Registered agent", portalField: "Registered agent Utah street address", answerKey: "registered_office" },
        { section: "Principal information", portalField: "Principals (name, title, address)", answerKey: "governors" },
        { section: "Supporting documentation", portalField: "Upload", answerKey: null, note: "Leave blank (uploads send the filing to manual review)" },
        {
          section: "Signature",
          portalField: "Attestations, name and title",
          answerKey: null,
          note: "Your own name as the customer's authorized filing agent, only after the comparison checkpoint.",
        },
      ],
      confirmationLabel: "Utah filing / order number",
      receipt: "The Division's acknowledgment of the filing (PDF or email).",
    },
    // Utah's attestation wording appears only in screenshots of the Division's guides, so no
    // text is quoted; the owner captures it during the portal walkthrough.
    stateAuthorization: {
      certificationText: null,
      certificationSourceFactKey: "signature_page",
      operatorCheckpoint: true,
    },
    sources: [
      src("state_fee", UT_URLS.feeSchedule, "Fee Schedule (FY2026)", p.feeQuote),
      ...COMMON,
      {
        factKey: "signature_page",
        url: UT_URLS.renewalGuide,
        title: "Annual Report/Renewal without Changes user guide (2025)",
        publisher: DIV,
        quote: "You will check the attestation, authorization and acknowledgement check boxes.",
        lastVerifiedAt: VERIFIED_V2,
      },
    ],
    lastVerifiedAt: VERIFIED_V2,
    verifiedBy: REVIEWER,
    notes:
      "S.B. 40 (effective 2026-10-01) moved the due date to the last day of the anniversary month; the Division may set a different period by rule. Re-check the Division's implementation and a FY2027 fee schedule before taking live orders.",
  };
}

export const UTAH_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

export const UTAH_FACTS = {
  businessSearchUrl: UT_URLS.registration,
  portalUrl: UT_URLS.registration,
  lookupMethod: "manual" as const,
};
