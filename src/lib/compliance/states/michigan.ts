import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Michigan profit corporation annual report (LARA, Corporations Division).
 *
 * Checked 2026-10-29, from LARA's own pages only. The report costs $25 and is due May 15
 * each year after incorporation or qualification; online filing opens January 15. A late
 * report adds $10 for each month or part of a month, up to $50 (May 16 to 31 is $10,
 * September 1 or later is $50).
 *
 * LLCs are out of scope: their annual statement (due February 15) has no late fee for a
 * regular LLC on LARA's page, so it doesn't fit Filewell's penalty-first expansion.
 *
 * Filing: since June 30, 2025 every filing needs a MiLogin for Business account and the
 * filer must request access to the entity in MiBusiness Registry. Whether a filing service
 * can get access to a client's corporation is open (mi_milogin_access), so sales and filing
 * stay closed. The report's contents and who may sign were taken from the statute on a page
 * that showed a CAPTCHA, so they're not cited here and are not verified.
 */

const VERIFIED = "2026-10-29";
const REVIEWER = "Official-source verification (LARA pages; automated research, quotes verbatim)";
const LARA = "Michigan Department of Licensing and Regulatory Affairs (LARA)";

export const MI_URLS = {
  roadmap: "https://www.michigan.gov/lara/bureau-list/cscl/corps/michigan-business-roadmap/annual-reports-and-annual-statements",
  renew: "https://www.michigan.gov/lara/bureau-list/cscl/corps/how-do-i/renewals/renew-my-corporation",
  portalNews: "https://www.michigan.gov/lara/news-releases/2025/06/30/michigan-launches-new-mibusiness-registry-portal-to-improve-business-filing-services",
  faq: "https://www.michigan.gov/lara/bureau-list/cscl/corps/frequently-asked-questions",
  registry: "https://mibusinessregistry.lara.state.mi.us/search/business",
} as const;

function src(factKey: string, url: string, title: string, quote: string): RuleSource {
  return { factKey, url, title, publisher: LARA, quote, lastVerifiedAt: VERIFIED };
}

/** Each step of the $10-a-month penalty: filed after the due date plus `graceDays`. */
const PENALTY_STEPS: { label: string; graceDays: number }[] = [
  { label: "Late penalty (May 16 to May 31)", graceDays: 0 },
  { label: "Late penalty (June)", graceDays: 16 },
  { label: "Late penalty (July)", graceDays: 46 },
  { label: "Late penalty (August)", graceDays: 77 },
  { label: "Late penalty (September or later)", graceDays: 108 },
];

function intakeFor(): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Michigan business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Michigan identification number",
            help: "Shown on MiBusiness Registry. Leave blank if you don't have it.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          { key: "nature_of_business", type: "text", label: "General nature of the business", required: true, maxLength: 300 },
        ],
      },
      {
        key: "registered_agent",
        title: "Resident agent",
        fields: [
          {
            key: "registered_agent_change",
            type: "choice",
            label: "Is your resident agent or registered office changing with this report?",
            required: true,
            options: [
              { value: "no", label: "No: keep what's on Michigan's record" },
              { value: "new", label: "Yes" },
            ],
            blocked: [
              { value: "new", message: "Filewell can't file a resident agent change with a Michigan report yet. You can file this report yourself on MiBusiness Registry." },
            ],
          },
          { key: "registered_agent_name", type: "text", label: "Resident agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered office address in Michigan", required: true, noPoBox: true, lockedRegion: "MI" },
        ],
      },
      {
        key: "people",
        title: "People",
        fields: [
          {
            key: "governors",
            type: "people",
            label: "President, secretary, treasurer and directors",
            help: "List the corporation's president, secretary, treasurer and every director, with an address for each.",
            required: true,
            min: 1,
            max: 20,
            titleSuggestions: ["President", "Secretary", "Treasurer", "Director"],
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
        ],
      },
    ],
  };
}

function buildRule(): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = PENALTY_STEPS.map((s, i) => ({
    key: `late_penalty_${i + 1}`,
    label: s.label,
    cents: 1000,
    trigger: { kind: "filed_after_due_date", graceDays: s.graceDays },
    sourceFactKey: "late_penalty",
  }));
  return {
    ruleKey: "MI:annual_report:corporation",
    stateCode: "MI",
    filingTypeCode: "annual_report",
    entityType: "corporation",
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-29): not sold. Open question mi_milogin_access keeps sales and filing closed.
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Annual Report",
    dueRule: { kind: "fixed_annual", month: 5, day: 15 },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 2500,
    nonprofitStateFeeCents: null,
    lateFeeCents: 5000,
    lateFees,
    // Online filing begins January 15.
    filingWindowDaysBefore: 120,
    lateFeeSummary: "Michigan adds $10 for each month or part of a month a corporation's report is late, up to $50.",
    consequenceSummary:
      "A late report adds $10 for each month or part of a month, up to $50, and the corporation falls out of good standing until it files.",
    whoMustFile: "Every Michigan profit corporation and every foreign corporation authorized in Michigan files an annual report each year after it was formed or qualified.",
    requiredInformation: [
      "Legal name and Michigan identification number",
      "Resident agent and registered office in Michigan",
      "President, secretary, treasurer and directors, with an address for each",
      "General nature of the business",
    ],
    intake: intakeFor(),
    officialFilingUrl: MI_URLS.registry,
    officialInfoUrl: MI_URLS.roadmap,
    filingMethodSummary:
      "Filed online in MiBusiness Registry with a MiLogin for Business account that has requested access to the corporation, then paid by card. Paper is no longer accepted.",
    processingSummary: "LARA files online annual reports in MiBusiness Registry.",
    customerSummary: "Michigan corporations file an annual report by May 15 each year, with a $25 state fee. Filing late adds $10 a month, up to $50.",
    faq: [
      { q: "When is a Michigan corporation's annual report due?", a: "By May 15 every year after the corporation was formed or qualified. Online filing opens January 15." },
      { q: "How much is the state fee?", a: "$25, paid to LARA. Our service fee, if you use us, is shown separately." },
      { q: "Is there a late penalty?", a: "Yes. $10 for each month or part of a month late, starting May 16, up to $50." },
      { q: "Can I file it myself?", a: "Yes, in MiBusiness Registry with a MiLogin for Business account." },
    ],
    operatorRunbook: {
      portalName: "MiBusiness Registry",
      portalUrl: MI_URLS.registry,
      access: "A MiLogin for Business account that has requested and received access to the corporation. Whether a filing service can do this for a client is not yet confirmed.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Sign in to MiBusiness Registry with Filewell's MiLogin for Business account and search the corporation.",
        "Request access if needed and answer the two access questions only with facts from the packet. If access is refused, stop and contact the customer.",
        "Pay a late penalty only if the order collected it; otherwise contact the customer first.",
        "Choose File Annual Report and make every value match the packet. Never change the resident agent here.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "Approve and File Online, pay by card and save the filed report.",
      ],
      fieldMap: [
        { section: "Search", portalField: "Identification number", answerKey: "entity_number" },
        { section: "Entity information", portalField: "Corporation name", answerKey: "legal_name" },
        { section: "Resident agent", portalField: "Resident agent", answerKey: "registered_agent_name", note: "Leave as on record" },
        { section: "Resident agent", portalField: "Registered office address", answerKey: "registered_office", note: "Leave as on record" },
        { section: "Officers and directors", portalField: "Names and addresses", answerKey: "governors" },
        { section: "Business", portalField: "General nature of business", answerKey: "nature_of_business" },
        { section: "Signature", portalField: "Signature", answerKey: null, note: "Only after the comparison checkpoint." },
      ],
      confirmationLabel: "Michigan filing number",
      receipt: "The filed annual report from MiBusiness Registry.",
    },
    stateAuthorization: {
      certificationText: null,
      certificationSourceFactKey: "milogin",
      operatorCheckpoint: true,
    },
    sources: [
      src("state_fee", MI_URLS.roadmap, "Annual Reports and Annual Statements", "Fee: $25.00"),
      src("due_date", MI_URLS.roadmap, "Annual Reports and Annual Statements", "Due Date: May 15 each year after incorporation/qualification."),
      src("filing_opens", MI_URLS.roadmap, "Annual Reports and Annual Statements", "Online filing begins January 15"),
      src("late_penalty_first", MI_URLS.roadmap, "Annual Reports and Annual Statements", "May 16 - May 31 | $10.00"),
      src("late_penalty_cap", MI_URLS.roadmap, "Annual Reports and Annual Statements", "September 1 or Thereafter | $50.00"),
      src("late_penalty", MI_URLS.renew, "Renew My Corporation", "the penalty fee is $10.00 per month or portion thereof, beginning May 16 (see section 921)."),
      src("milogin", MI_URLS.portalNews, "Michigan Launches New MiBusiness Registry Portal", "All access and filings now require a secure login through MiLogin for Business."),
      src("online_only", MI_URLS.portalNews, "Michigan Launches New MiBusiness Registry Portal", "Annual reports and statements must now be filed online."),
      src("access_request", MI_URLS.renew, "Renew My Corporation", "Answer two questions to receive access, refresh page."),
    ],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      "Not verified: the report's contents, who may sign, the two-year automatic dissolution, and that a corporation formed January 1 to May 15 skips that year (all from statute pages behind a CAPTCHA, not cited). Filewell's window opens January 1 for fixed-date rules; LARA opens online filing January 15.",
  };
}

export const MICHIGAN_RULES: ComplianceRuleDef[] = [buildRule()];
