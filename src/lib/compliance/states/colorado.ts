import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Colorado Periodic Report (Secretary of State, Business Division).
 *
 * Checked 2026-10-29. The report costs $25 and is due by the last day of the second month
 * after the entity's Periodic Report Month ("If the Periodic Report Month is January, the
 * report due date will be March 31st"). It can be filed from two months before the report
 * month, so the window is about five months. After the due date the Secretary charges a
 * $50 late filing penalty; the entity becomes Noncompliant and then Delinquent, which costs
 * $100 to cure.
 *
 * Filing: no account unless the business turned on Secure Business Filing, in which case
 * the owner adds Filewell as an authorized user. The report names "at least one individual
 * causing the document to be delivered for filing", and delivery is that individual's
 * affirmation under penalties of perjury. So the customer signs (owner decision 2026-10-30):
 * the customer is the individual named, and makes Colorado's affirmation themselves in
 * Filewell, word for word; the operator enters the customer's name and the business's
 * mailing address there. Filewell never names its own operator as that individual.
 *
 * Periodic Report Month: Filewell models it as the formation (or registration) month. The
 * Secretary shows the actual month on each entity's summary page; the operator checks it.
 *
 * Launch scope: LLCs and for-profit corporations only.
 */

const VERIFIED = "2026-10-29";
const REVIEWER = "Official-source verification (Colorado Secretary of State pages; automated research, quotes verbatim)";
const SOS = "Colorado Secretary of State";

export const CO_URLS = {
  fees: "https://www.sos.state.co.us/pubs/info_center/fees/business.html",
  reportsFaq: "https://www.sos.state.co.us/pubs/business/FAQs/reports.html",
  delinquencyFaq: "https://www.sos.state.co.us/pubs/business/FAQs/delinquency.html",
  reportHelp: "https://www.sos.state.co.us/pubs/business/helpFiles/REPORT_HELP.html",
  secureFiling: "https://www.coloradosos.gov/pubs/business/FAQs/secureFiling.html",
  noticeForm: "https://coloradosos.gov/pubs/business/sampleForms/RESTATE.pdf",
  search: "https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do",
  info: "https://www.coloradosos.gov/pubs/business/businessHome.html",
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = SOS): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
}

/**
 * Colorado's notice on its filing forms, verbatim (sample form on the Secretary's site). The
 * online Periodic Report's own notice wasn't read; the operator compares it at the checkpoint.
 */
export const CO_DELIVERY_NOTICE =
  "Causing this document to be delivered to the Secretary of State for filing shall constitute the affirmation or acknowledgment of each individual causing such delivery, under penalties of perjury, that such document is such individual's act and deed, or that such individual in good faith believes such document is the act and deed of the person on whose behalf such individual is causing such document to be delivered for filing, taken in conformity with the requirements of part 3 of article 90 of title 7, C.R.S. and, if applicable, the constituent documents and the organic statutes, and that such individual in good faith believes the facts stated in such document are true and such document complies with the requirements of that Part, the constituent documents, and the organic statutes.";

const COMMON: RuleSource[] = [
  src("state_fee", CO_URLS.fees, "Business fees", "Periodic Report | $25.00 | n/a"),
  src("late_fee", CO_URLS.fees, "Business fees", "Periodic Report Late Filing Penalty | $50.00 | n/a"),
  src("cure_fee", CO_URLS.fees, "Business fees", "Statement Curing Delinquency | $100.00 | n/a"),
  src("due_date", CO_URLS.delinquencyFaq, "Delinquency FAQs", "If the Periodic Report Month is January, the report due date will be March 31st."),
  src(
    "filing_window",
    CO_URLS.reportsFaq,
    "Periodic Report FAQs",
    "The Periodic Report can be filed two months prior to the Periodic Report month or two months after without any penalty.",
  ),
  src("report_month", CO_URLS.reportsFaq, "Periodic Report FAQs", "You can find your reporting month on the entity’s Summary page under ‘Periodic report month’."),
  src("noncompliant", CO_URLS.delinquencyFaq, "Delinquency FAQs", "the entity's status will become Noncompliant"),
  src("delinquent", CO_URLS.delinquencyFaq, "Delinquency FAQs", "will become Delinquent pursuant to section 7-90-901, C.R.S."),
  src(
    "cure",
    CO_URLS.delinquencyFaq,
    "Delinquency FAQs",
    "a Statement Curing Delinquency must be filed to return the entity's status to Good Standing.",
  ),
  src("name_hold", CO_URLS.delinquencyFaq, "Delinquency FAQs", "The delinquent entity name is saved for the entity for 400 days from the date of delinquency."),
  src("principal_office", CO_URLS.reportHelp, "Periodic Report help", "A principal office street address is required."),
  src(
    "individual_causing_delivery",
    CO_URLS.reportHelp,
    "Periodic Report help",
    "Provide the last name and first name of at least one individual causing the document to be delivered for filing.",
  ),
  src("delivery_notice", CO_URLS.noticeForm, "Secretary of State form, Notice", CO_DELIVERY_NOTICE),
  src(
    "one_individual",
    CO_URLS.noticeForm,
    "Secretary of State form, Filer's information",
    "The document need not state the true name and address of more than one individual.",
  ),
  src(
    "delivery_responsibility",
    CO_URLS.reportHelp,
    "Periodic Report help",
    "Each individual causing the document to be filed is responsible for complying with the applicable statutes.",
  ),
  src("prefilled", CO_URLS.reportHelp, "Periodic Report help", "This information cannot be changed by filing this document."),
  src(
    "secure_filing",
    CO_URLS.secureFiling,
    "Secure Business Filing FAQs",
    "Once you have Secure Business Filing, documents can't be filed without the correct email address and associated password.",
  ),
];

interface CoProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
}

const PROFILES: CoProfile[] = [
  { entityType: "llc", noun: "LLC", pluralNoun: "LLCs" },
  { entityType: "corporation", noun: "corporation", pluralNoun: "corporations" },
];

function intakeFor(): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Colorado business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Colorado ID number",
            help: "Shown on your business's summary page on the Colorado Secretary of State's site.",
            required: true,
            maxLength: 20,
            pattern: "^[0-9]{1,20}$",
            patternMessage: "Use numbers only.",
          },
          {
            key: "secure_business_filing",
            type: "choice",
            label: "Does your business use Colorado's Secure Business Filing (a password on your business record)?",
            required: true,
            options: [
              { value: "no", label: "No" },
              { value: "yes", label: "Yes, and I'll add Filewell as an authorized user" },
              { value: "unsure", label: "Not sure" },
            ],
          },
        ],
      },
      {
        key: "addresses",
        title: "Addresses",
        fields: [
          { key: "principal_office", type: "address", label: "Principal office street address", required: true, noPoBox: true },
          { key: "mailing_address", type: "address", label: "Principal office mailing address", help: "Can be the same as the street address.", required: true },
        ],
      },
      {
        key: "registered_agent",
        title: "Registered agent",
        description: "The Periodic Report confirms the registered agent on record.",
        fields: [
          {
            key: "registered_agent_change",
            type: "choice",
            label: "Is your registered agent changing with this report?",
            required: true,
            options: [
              { value: "no", label: "No: keep the registered agent on Colorado's record" },
              { value: "new", label: "Yes, we're appointing a new registered agent" },
            ],
            blocked: [
              {
                value: "new",
                message: "Filewell can't file a registered agent change with a Colorado report yet. You can file this report yourself on the Secretary of State's site.",
              },
            ],
          },
          { key: "registered_agent_name", type: "text", label: "Registered agent name", required: true, maxLength: 200 },
          { key: "registered_office", type: "address", label: "Registered agent street address in Colorado", required: true, noPoBox: true, lockedRegion: "CO" },
        ],
      },
      {
        key: "extras",
        title: "Anything else",
        fields: [
          {
            key: "changes_since_last_report",
            type: "choice",
            label: "Has any of this changed since your last Periodic Report?",
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
            label: "Email for Colorado's report reminders",
            help: "Colorado can send Periodic Report reminders to this email.",
            required: false,
          },
        ],
      },
    ],
  };
}

function buildRule(p: CoProfile): ComplianceRuleDef {
  const lateFees: LateFeeRule[] = [
    { key: "late_filing_penalty", label: "Periodic Report late filing penalty", cents: 5000, trigger: { kind: "filed_after_due_date" }, sourceFactKey: "late_fee" },
  ];
  return {
    ruleKey: `CO:annual_report:${p.entityType}`,
    stateCode: "CO",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-29). Since 2026-10-30 the customer is the individual causing delivery (customerSignature).
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
    filingName: "Periodic Report",
    dueRule: { kind: "anniversary_month_end", monthsAfter: 2 },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: 2500,
    nonprofitStateFeeCents: null,
    lateFeeCents: 5000,
    lateFees,
    // From the first day of the month two months before the report month to the due date. The
    // shortest such window (November 1 to March 31, or October 1 to February 28) is 150 days.
    filingWindowDaysBefore: 150,
    lateFeeSummary: "Colorado charges a $50 late filing penalty on a Periodic Report filed after its due date.",
    consequenceSummary:
      "A late report costs an extra $50 and the business becomes Noncompliant. If it still isn't filed, the business becomes Delinquent, which costs $100 to cure, and Colorado holds its name for only 400 days.",
    whoMustFile: `Every Colorado ${p.noun} and every foreign ${p.noun} registered in Colorado files a Periodic Report each year.`,
    requiredInformation: [
      "Legal name and Colorado ID number",
      "Principal office street and mailing address",
      "Registered agent and its Colorado street address",
      "The individual causing the report to be delivered for filing",
    ],
    intake: intakeFor(),
    officialFilingUrl: CO_URLS.search,
    officialInfoUrl: CO_URLS.reportsFaq,
    filingMethodSummary:
      "Filed online from the business's record on the Colorado Secretary of State's site, naming the individual who causes it to be delivered, and paid by card. A business with Secure Business Filing needs its password or an authorized user.",
    processingSummary: "Colorado files online Periodic Reports right away.",
    customerSummary: `Colorado ${p.pluralNoun} file a Periodic Report each year by the last day of the second month after their Periodic Report Month, with a $25 state fee. Filing late adds a $50 penalty.`,
    faq: [
      {
        q: `When is a Colorado ${p.noun}'s Periodic Report due?`,
        a: "By the last day of the second month after your Periodic Report Month (usually the month the business was formed). You can file from two months before that month.",
      },
      { q: "How much is the state fee?", a: "$25, paid to the Colorado Secretary of State. Our service fee, if you use us, is shown separately." },
      { q: "Is there a late fee?", a: "Yes. Colorado adds a $50 penalty to a report filed after its due date." },
      { q: "Can I file it myself?", a: "Yes. You can file directly on the Colorado Secretary of State's site." },
    ],
    operatorRunbook: {
      portalName: "Colorado Secretary of State business filing",
      portalUrl: CO_URLS.search,
      access:
        "No account for most businesses. If the business uses Secure Business Filing, the owner must first add Filewell's account as an authorized user.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Search the business by its ID number and open its summary page. Check the Periodic report month and the due date match the packet.",
        "If Secure Business Filing blocks you, stop and ask the customer to add Filewell as an authorized user.",
        "Pay the $50 late filing penalty only if the order collected it; otherwise contact the customer first.",
        "Choose File a form, then the Periodic Report, and make every value match the packet. Never change the registered agent here.",
        "On the review screen, compare every value with the packet, then record the comparison checkpoint in Filewell.",
        "If the portal's notice about causing delivery reads differently from the packet's, stop: the customer must sign the new wording first.",
        "Enter the customer's name exactly as they signed in Filewell, with the business's mailing address, as the individual causing the document to be delivered. Never enter your own name. Pay by card and save the filed report.",
      ],
      fieldMap: [
        { section: "Entity information", portalField: "ID number", answerKey: "entity_number" },
        { section: "Entity information", portalField: "Entity name", answerKey: "legal_name", note: "Pre-filled; can't be changed here" },
        { section: "Principal office", portalField: "Principal office street address", answerKey: "principal_office" },
        { section: "Principal office", portalField: "Principal office mailing address", answerKey: "mailing_address" },
        { section: "Registered agent", portalField: "Registered agent name", answerKey: "registered_agent_name", note: "Leave as on record" },
        { section: "Registered agent", portalField: "Registered agent street address", answerKey: "registered_office", note: "Leave as on record" },
        { section: "Notice", portalField: "Email reminders", answerKey: "state_notice_email" },
        {
          section: "Individual causing delivery",
          portalField: "Name and mailing address",
          answerKey: null,
          note: "The customer's name exactly as they signed in Filewell, with the principal office mailing address, only after the comparison checkpoint.",
        },
      ],
      confirmationLabel: "Colorado document number",
      receipt: "The filed Periodic Report (PDF) from the business's record.",
    },
    stateAuthorization: {
      certificationText: CO_DELIVERY_NOTICE,
      certificationSourceFactKey: "delivery_notice",
      operatorCheckpoint: true,
      customerSignature: { warnings: [], signerIsDeliverer: true },
    },
    sources: [
      src("who_must_file", CO_URLS.reportsFaq, "Periodic Report FAQs", `Reporting entities, such as limited liability companies, corporations, nonprofit corporations, and foreign entities`),
      ...COMMON,
    ],
    lastVerifiedAt: VERIFIED,
    verifiedBy: REVIEWER,
    notes:
      "Not verified: that the Periodic Report Month is always the formation month (the statute wasn't re-read; the operator checks the month on the summary page), and the 60-day Noncompliant-to-Delinquent period (the official page wording was not re-read in this check).",
  };
}

export const COLORADO_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

export const COLORADO_FACTS = {
  businessSearchUrl: CO_URLS.search,
  portalUrl: CO_URLS.search,
  lookupMethod: "manual" as const,
};
