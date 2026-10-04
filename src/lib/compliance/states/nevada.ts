import type { EntityType } from "@/lib/domain/types";
import type { ComplianceRuleDef, IntakeSchema, LateFeeRule, RuleSource } from "../types";

/**
 * Nevada Annual List + State Business License renewal (Title 7 entities).
 *
 * Every amount and deadline below is quoted from the Nevada Revised Statutes as
 * published by the Legislature (leg.state.nv.us, chapters revised 4/15/2026, including
 * the 2025 session), checked 2026-10-01. The Secretary of State's own pages (nvsos.gov,
 * orion.nv.gov) sit behind bot protection and could not be read automatically; their fee
 * schedules match the statute where search summaries surfaced them. An operator confirms
 * the exact amount shown in the state portal before paying.
 *
 * Scope (v1): domestic and foreign LLCs, corporations (lowest share-value tier only),
 * limited partnerships (incl. LLLPs) and LLPs. Not yet: nonprofit corporations (NRS 82),
 * business trusts, corporations whose authorized stock exceeds $75,000.
 */

const VERIFIED = "2026-10-01";
const VERIFIED_V2 = "2026-10-04";
const REVIEWER = "Statute verification against leg.state.nv.us (automated research, quotes verbatim)";
const LEG = "Nevada Legislature (Nevada Revised Statutes)";

export const NV_URLS = {
  nrs76: "https://www.leg.state.nv.us/NRS/NRS-076.html",
  nrs78: "https://www.leg.state.nv.us/NRS/NRS-078.html",
  nrs80: "https://www.leg.state.nv.us/NRS/NRS-080.html",
  nrs86: "https://www.leg.state.nv.us/NRS/NRS-086.html",
  nrs87: "https://www.leg.state.nv.us/NRS/NRS-087.html",
  nrs87a: "https://www.leg.state.nv.us/NRS/NRS-087A.html",
  sosInfo: "https://www.nvsos.gov/businesses",
  /** ORION business portal (replaced SilverFlume, September 2026). */
  portal: "https://orion.nv.gov/portal/public/",
  businessSearch: "https://www.nvsos.gov/businesses/business-entity-search",
  /** Secretary of State forms, Revised 7/1/2026 (served from the SOS BizHub content host). */
  formNonCorp: "https://content.bizhub.nv.gov/uploads/bizhub/Annual_List_and_State_Business_License_Non_Corps_Final_6904713d13.pdf",
  formCorp: "https://content.bizhub.nv.gov/uploads/bizhub/Annual_List_and_State_Business_License_Corps_Final_2aebeed395.pdf",
} as const;

const SOS = "Nevada Secretary of State";

function src(factKey: string, url: string, title: string, quote: string, publisher = LEG, verified = VERIFIED): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: verified };
}

/** Sources added with rule v2 (checked 2026-10-04). */
function src2(factKey: string, url: string, title: string, quote: string, publisher = LEG): RuleSource {
  return src(factKey, url, title, quote, publisher, VERIFIED_V2);
}

const SBL_SOURCES: RuleSource[] = [
  src(
    "business_license_fee",
    NV_URLS.nrs76,
    "NRS 76.130 / 76.100 State business license",
    "a fee in the amount of $200, except that if the applicant is a corporation organized pursuant to chapter 78, 78A or 78B of NRS, or a foreign corporation required to file an initial or annual list ... pursuant to chapter 80 of NRS, the application must be accompanied by a fee of $500",
  ),
  src(
    "business_license_timing",
    NV_URLS.nrs76,
    "NRS 76.130(1)(a)",
    "at the time the person submits the annual list",
  ),
  src(
    "business_license_penalty",
    NV_URLS.nrs76,
    "NRS 76.130(4)(a)",
    "Shall pay a penalty of $100 in addition to the annual state business license fee",
  ),
];

interface NvProfile {
  entityType: EntityType;
  noun: string;
  pluralNoun: string;
  chapter: string;
  dueQuote: RuleSource;
  listFeeQuote: RuleSource;
  listPenaltyQuote: RuleSource;
  contentsQuote: RuleSource;
  licenseFeeCents: number;
  peopleLabel: string;
  peopleHelp: string;
  peopleTitles: string[];
  corporation?: boolean;
  /** The list's signature certification and declaration under penalty of perjury, verbatim from the statute. */
  certification: string;
  certificationSource: RuleSource;
  /** Whether the 7/1/2026 form's investigation disclosure applies (LLCs, LPs/LLLPs, corporations). */
  disclosure: boolean;
}

function declaration(entity: string, people: string, person: string, filedIn: "in" | "with"): string {
  return (
    `Certifying that the list is true, complete and accurate; and a declaration under penalty of perjury that: ` +
    `(a) The ${entity} has complied with the provisions of chapter 76 of NRS; ` +
    `(b) The ${entity} acknowledges that pursuant to NRS 239.330, it is a category C felony to knowingly offer any false or forged instrument for filing ${filedIn} the Office of the Secretary of State; and ` +
    `(c) None of the ${people} identified in the list has been identified in the list with the fraudulent intent of concealing the identity of any person or persons exercising the power or authority of ${person} in furtherance of any unlawful conduct.`
  );
}

const PROFILES: NvProfile[] = [
  {
    entityType: "llc",
    noun: "LLC",
    pluralNoun: "LLCs",
    chapter: "NRS 86",
    dueQuote: src("due_date", NV_URLS.nrs86, "NRS 86.263(2)", "on or before the last day of the month in which the anniversary date of its organization occurs"),
    listFeeQuote: src("annual_list_fee", NV_URLS.nrs86, "NRS 86.263(4) / 86.5461(3)", "$150"),
    listPenaltyQuote: src("annual_list_penalty", NV_URLS.nrs86, "NRS 86.272(3)", "For default there must be added to the amount of the fee a penalty of $75."),
    contentsQuote: src(
      "required_contents",
      NV_URLS.nrs86,
      "NRS 86.263(1)(c)",
      "The names and titles of all of its managers or, if there is no manager, all of its managing members",
    ),
    licenseFeeCents: 20000,
    peopleLabel: "Managers or managing members",
    peopleHelp: "List every manager. If the LLC has no managers, list every managing member. Nevada asks for an address for each.",
    peopleTitles: ["Manager", "Managing Member"],
    certification: declaration("limited-liability company", "managers or managing members", "a manager or managing member", "in"),
    certificationSource: src2("certification", NV_URLS.nrs86, "NRS 86.263(1)(e) and (3)", "certifying that the list is true, complete and accurate"),
    disclosure: true,
  },
  {
    entityType: "corporation",
    noun: "corporation",
    pluralNoun: "corporations",
    chapter: "NRS 78 / NRS 80",
    dueQuote: src(
      "due_date",
      NV_URLS.nrs78,
      "NRS 78.150(1)-(2)",
      "annually thereafter, on or before the last day of the month in which the anniversary date of incorporation occurs in each year",
    ),
    listFeeQuote: src("annual_list_fee", NV_URLS.nrs78, "NRS 78.150(4)(b) / 80.110(3)", "$75,000 or less ... $150"),
    listPenaltyQuote: src("annual_list_penalty", NV_URLS.nrs78, "NRS 78.170(3)", "For default there must be added to the amount of the fee a penalty of $75."),
    contentsQuote: src(
      "required_contents",
      NV_URLS.nrs78,
      "NRS 78.150(1)",
      "The names and titles of the president, secretary and treasurer, or the equivalent thereof, and of all the directors; (d) The address, either residence or business, of each officer and director",
    ),
    licenseFeeCents: 50000,
    peopleLabel: "Officers and directors",
    peopleHelp: "List the president, secretary and treasurer (or equivalents) and every director, with a residence or business address for each. One person may hold several roles.",
    peopleTitles: ["President", "Secretary", "Treasurer", "Director"],
    corporation: true,
    certification: declaration("corporation", "officers or directors", "an officer or director", "with"),
    certificationSource: src2("certification", NV_URLS.nrs78, "NRS 78.150(1)(e) and (3)(a)", "certifying that the list is true, complete and accurate"),
    disclosure: true,
  },
  {
    entityType: "lp",
    noun: "limited partnership",
    pluralNoun: "limited partnerships (including LLLPs)",
    chapter: "NRS 87A / NRS 88",
    dueQuote: src(
      "due_date",
      NV_URLS.nrs87a,
      "NRS 87A.290",
      "on or before the last day of the month in which the anniversary date of the filing of its certificate of limited partnership occurs",
    ),
    listFeeQuote: src("annual_list_fee", NV_URLS.nrs87a, "NRS 87A.290(3)-(4)", "$150"),
    listPenaltyQuote: src("annual_list_penalty", NV_URLS.nrs87a, "NRS 87A.300(4)", "For default there must be added to the amount of the fee a penalty of $75."),
    contentsQuote: src("required_contents", NV_URLS.nrs87a, "NRS 87A.290", "the name and address of each general partner"),
    licenseFeeCents: 20000,
    peopleLabel: "General partners",
    peopleHelp: "List every general partner with a residence or business address.",
    peopleTitles: ["General Partner"],
    certification: declaration("limited partnership", "general partners", "a general partner", "in"),
    certificationSource: src2("certification", NV_URLS.nrs87a, "NRS 87A.290(1)(e) and (2)", "certifying that the list is true, complete and accurate"),
    disclosure: true,
  },
  {
    entityType: "llp",
    noun: "limited liability partnership",
    pluralNoun: "limited liability partnerships",
    chapter: "NRS 87",
    dueQuote: src(
      "due_date",
      NV_URLS.nrs87,
      "NRS 87.510",
      "on or before the last day of the month in which the anniversary date of the filing of its certificate of registration occurs",
    ),
    listFeeQuote: src("annual_list_fee", NV_URLS.nrs87, "NRS 87.510(3) / 87.541(3)", "$150"),
    listPenaltyQuote: src("annual_list_penalty", NV_URLS.nrs87, "NRS 87.520(3)", "For default there must be added to the amount of the fee a penalty of $75."),
    contentsQuote: src("required_contents", NV_URLS.nrs87, "NRS 87.510", "the name and address of each managing partner"),
    licenseFeeCents: 20000,
    peopleLabel: "Managing partners",
    peopleHelp: "List every managing partner with a residence or business address.",
    peopleTitles: ["Managing Partner"],
    certification: declaration("registered limited-liability partnership", "managing partners", "a managing partner", "in"),
    certificationSource: src2("certification", NV_URLS.nrs87, "NRS 87.510(1)(e) and (2)", "certifying that the list is true, complete and accurate"),
    disclosure: false,
  },
];

const COMMON: RuleSource[] = [
  src("early_filing", NV_URLS.nrs86, "NRS 86.263(9) / 78.150(9)", "more than 90 days before its due date shall be deemed an amended list for the previous year"),
  src("notice", NV_URLS.nrs78, "NRS 78.150(7)", "Failure ... to receive a notice does not excuse it from the penalty"),
  src(
    "default",
    NV_URLS.nrs78,
    "NRS 78.170(1)",
    "refuses or neglects to do so within the time provided shall be deemed in default",
  ),
  src(
    "revocation",
    NV_URLS.nrs78,
    "NRS 78.175(2)",
    "On the first day of the first anniversary of the month following the month in which the filing was required, the charter of the corporation is revoked",
  ),
  src(
    "signature",
    NV_URLS.nrs78,
    "NRS 78.150(1)(e)",
    "an officer of the corporation, or some other person specifically authorized by the corporation to sign the list, certifying that the list is true, complete and accurate",
  ),
  src(
    "license_required",
    NV_URLS.nrs76,
    "NRS 76.020(1)(c)",
    "Any entity organized pursuant to this title ... whether or not the entity performs a service or engages in a business for profit",
  ),
  ...SBL_SOURCES,
  src2(
    "license_signer",
    NV_URLS.nrs76,
    "NRS 76.100(3)",
    "The application must be signed pursuant to NRS 239.330 by: ... (c) A general partner of a limited partnership. (d) A managing partner of a limited-liability partnership. (e) A manager or managing member of a limited-liability company. (f) An officer of a corporation or some other person specifically authorized by the corporation to sign the application.",
  ),
  src2(
    "license_location",
    NV_URLS.nrs76,
    "NRS 76.100(2)",
    "If the applicant is an entity organized pursuant to this title and on file with the Secretary of State and the applicant has no location in this State of its place of business, the address of its registered agent shall be deemed to be the location in this State of its place of business.",
  ),
  src2(
    "form_signer",
    NV_URLS.formNonCorp,
    "Annual or Amended List and State Business License - Non-Corporations (Revised 7/1/2026)",
    "This form must be signed by a natural person serving as a member of management, or authorized to sign on behalf of an entity to sign.",
    SOS,
  ),
  src2(
    "investigation_disclosure",
    NV_URLS.formNonCorp,
    "Annual or Amended List and State Business License - Non-Corporations (Revised 7/1/2026)",
    "If you chose \"yes\" to both questions, provide details for each investigation, including jurisdiction, summary, litigation documents, and outcome",
    SOS,
  ),
  src2(
    "license_exemption",
    NV_URLS.formNonCorp,
    "Annual or Amended List and State Business License - Non-Corporations (Revised 7/1/2026)",
    "Your entity is only eligible for a fee exemption if it is a governmental entity, a certain type of insurance company or a tax-exempt limited-liability company pursuant to 26 U.S.C. 501(c).",
    SOS,
  ),
];

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
];

function money(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function intakeFor(p: NvProfile): IntakeSchema {
  return {
    sections: [
      {
        key: "record",
        title: "Business record",
        description: "Enter these exactly as they appear on your Nevada business record.",
        fields: [
          { key: "legal_name", type: "text", label: "Legal name", required: true, maxLength: 300 },
          {
            key: "entity_number",
            type: "text",
            label: "Nevada entity number",
            help: "The entity or NV Business ID shown on the Nevada Secretary of State's business search. Leave blank if you don't have it and we'll find it.",
            required: false,
            maxLength: 30,
            pattern: "^[A-Za-z0-9-]{1,30}$",
            patternMessage: "Use letters, numbers and dashes only.",
          },
          {
            key: "jurisdiction_of_formation",
            type: "text",
            label: "Jurisdiction of formation",
            help: "Nevada, or the state or country where a foreign entity was formed.",
            required: true,
            maxLength: 100,
          },
          {
            key: "sbl_exemption",
            type: "choice",
            label: "Is the entity exempt from the State Business License fee?",
            help: "Only governmental entities, certain insurance companies (licensed by the Division of Insurance) and 501(c) tax-exempt LLCs qualify.",
            required: true,
            options: [
              { value: "no", label: "No, it pays the business license fee" },
              { value: "yes", label: "Yes, it is exempt" },
            ],
            blocked: [{ value: "yes", message: "We can't file for business-license-exempt entities yet. You can file directly with the Nevada Secretary of State." }],
          },
          ...(p.corporation
            ? [
                {
                  key: "authorized_stock_tier",
                  type: "choice" as const,
                  label: "Authorized stock value",
                  help: "Nevada sets a corporation's annual list fee from the value of its authorized shares (number of shares times par value; no-par shares count as $1 each).",
                  required: true,
                  options: [
                    { value: "75k_or_less", label: "$75,000 or less" },
                    { value: "over_75k", label: "More than $75,000" },
                  ],
                  blocked: [
                    {
                      value: "over_75k",
                      message: "We can't file lists for corporations above the $75,000 tier online yet. Email support and we'll quote the exact state fee.",
                    },
                  ],
                },
                {
                  key: "publicly_traded",
                  type: "choice" as const,
                  label: "Is the corporation publicly traded?",
                  help: "Nevada's annual list asks this. Publicly traded companies also give their SEC Central Index Key.",
                  required: true,
                  options: [
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes" },
                  ],
                  blocked: [{ value: "yes", message: "We can't file for publicly traded corporations yet." }],
                },
              ]
            : []),
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
            withAddress: { label: "Address (residence or business)", help: "Street, city, state and ZIP." },
          },
          ...(p.entityType === "llc"
            ? [
                {
                  key: "llc_management",
                  type: "choice" as const,
                  label: "Is the LLC manager-managed or member-managed?",
                  help: "Foreign LLCs indicate this on the list. It must match the articles of organization.",
                  required: false,
                  options: [
                    { value: "manager", label: "Manager-managed" },
                    { value: "member", label: "Member-managed" },
                  ],
                },
              ]
            : []),
        ],
      },
      ...(p.disclosure
        ? [
            {
              key: "investigation_disclosure",
              title: "Investigation disclosure",
              description: "Nevada's annual list (revised July 1, 2026) asks these two questions exactly as worded here.",
              fields: [
                {
                  key: "nv_trade_investigations",
                  type: "choice" as const,
                  label:
                    "In the past 5 years, has the company, its parent, or its subsidiaries faced five or more investigations in the United States, including state and federal investigations, that involve alleged contracts, combinations, or conspiracies to restrain trade, as described in NRS 598A.060 or similar laws in other jurisdictions; and resulted in fines, penalties, required divestitures, or restrictions on acquiring holdings as part of the settlement or resolution?",
                  required: true,
                  options: YES_NO,
                },
                {
                  key: "nv_market_share",
                  type: "choice" as const,
                  label: "Additionally, does the company control 25 percent or more of the market share for any product sold or distributed within this State?",
                  required: true,
                  options: YES_NO,
                  blocked: [
                    {
                      value: "yes",
                      when: [{ key: "nv_trade_investigations", in: ["yes"] }],
                      message:
                        "When both answers are Yes, Nevada requires detailed investigation disclosures and a $100,000 fee. We can't file that online; you can file directly with the Nevada Secretary of State.",
                    },
                  ],
                },
              ],
            },
          ]
        : []),
      {
        key: "principal_office",
        title: "Business location in Nevada",
        description:
          "Nevada's state business license lists your business location in Nevada. If the business has no Nevada location, enter your registered agent's Nevada address: Nevada treats it as your business location.",
        fields: [{ key: "principal_office", type: "address", label: "Business location in Nevada", required: true, noPoBox: true, lockedRegion: "NV" }],
      },
      {
        key: "extras",
        title: "Anything else",
        fields: [
          {
            key: "changes_since_last_report",
            type: "choice",
            label: "Has any of this changed since your last annual list?",
            required: false,
            options: [
              { value: "no", label: "No changes" },
              { value: "yes", label: "Yes, something changed" },
              { value: "unsure", label: "Not sure" },
            ],
          },
          { key: "state_notice_email", type: "email", label: "Email for Nevada's notices", required: false },
        ],
      },
    ],
  };
}

function buildRule(p: NvProfile): ComplianceRuleDef {
  const listFee = 15000;
  const total = listFee + p.licenseFeeCents;
  const lateFees: LateFeeRule[] = [
    { key: "annual_list_penalty", label: "Annual List late penalty", cents: 7500, trigger: { kind: "filed_after_due_date" }, sourceFactKey: "annual_list_penalty" },
    { key: "business_license_penalty", label: "State Business License late penalty", cents: 10000, trigger: { kind: "filed_after_due_date" }, sourceFactKey: "business_license_penalty" },
  ];
  return {
    ruleKey: `NV:annual_report:${p.entityType}`,
    stateCode: "NV",
    filingTypeCode: "annual_report",
    entityType: p.entityType,
    appliesTo: "domestic_and_foreign",
    // v1 (2026-10-01) never took an order. v2 follows the Secretary of State's annual list form
    // (Revised 7/1/2026): exemption, investigation disclosure, Nevada business location, and the
    // statutory certification/declaration the customer confirms before an agent signs.
    version: 2,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED_V2,
    filingName: "Annual List and State Business License renewal",
    dueRule: { kind: "anniversary_month_end" },
    firstDueRule: { kind: "year_after_formation" },
    stateFeeCents: total,
    nonprofitStateFeeCents: null,
    lateFeeCents: 17500,
    feeComponents: [
      { key: "annual_list", label: p.corporation ? "Annual List fee (authorized stock $75,000 or less)" : "Annual List fee", cents: listFee, sourceFactKey: "annual_list_fee" },
      { key: "business_license", label: "State Business License fee", cents: p.licenseFeeCents, sourceFactKey: "business_license_fee" },
    ],
    lateFees,
    filingWindowDaysBefore: 90,
    lateFeeSummary:
      "If the list is filed after the due date, Nevada adds a $75 Annual List penalty and a $100 State Business License penalty.",
    consequenceSummary:
      "An entity that misses the due date is in default. A domestic entity's charter is revoked on the first day of the first anniversary of the month after the month the list was due; a foreign entity forfeits its right to do business in Nevada. Reinstatement costs extra fees.",
    whoMustFile: `Every Nevada ${p.noun}, and every foreign ${p.noun} registered in Nevada, files an annual list each year and renews its State Business License at the same time.`,
    requiredInformation: [
      "Legal name and Nevada entity number",
      p.corporation
        ? "Names and titles of the president, secretary, treasurer (or equivalents) and all directors, with an address for each"
        : `Names of all ${p.peopleLabel.toLowerCase()}, with an address for each`,
      "Place of business for the State Business License",
      ...(p.corporation ? ["Whether the corporation is publicly traded", "The value of authorized stock (sets the list fee)"] : []),
      "A declaration that the entity complies with Nevada's business license law (NRS 76)",
    ],
    intake: intakeFor(p),
    officialFilingUrl: NV_URLS.portal,
    officialInfoUrl: NV_URLS.sosInfo,
    filingMethodSummary:
      "Filed online with the Nevada Secretary of State through its business portal (ORION, which replaced SilverFlume in September 2026): find the entity, file the annual list, renew the State Business License and pay both fees together.",
    processingSummary: "The Secretary of State processes the list and renews the license; the confirmation comes from the state portal.",
    customerSummary: `Nevada ${p.pluralNoun} file an annual list and renew the State Business License by the last day of their anniversary month: ${money(listFee)} list fee + ${money(p.licenseFeeCents)} license fee = ${money(total)} in state fees.`,
    faq: [
      {
        q: `When is a Nevada ${p.noun}'s annual list due?`,
        a: "By the last day of the month in which the entity was formed (or registered in Nevada, for a foreign entity), every year after the initial list.",
      },
      {
        q: "Why are there two state fees?",
        a: `The annual list fee (${money(listFee)}) and the State Business License fee (${money(p.licenseFeeCents)}) are separate Nevada charges paid together when the list is filed.`,
      },
      {
        q: "Is there a late fee?",
        a: "Yes. Filed after the due date, Nevada adds a $75 annual list penalty and a $100 business license penalty.",
      },
      {
        q: "Can I file it myself?",
        a: "Yes. You can file directly with the Nevada Secretary of State online. Using a filing service is optional.",
      },
    ],
    operatorRunbook: {
      portalName: "Nevada ORION business portal (Secretary of State)",
      portalUrl: NV_URLS.portal,
      access:
        "An ORION user account (existing SilverFlume credentials carry over). Whether a filing service's account can file for a client entity, and the LLC/LP/LLP business-license signer, are open questions: Filewell blocks filing until both are resolved. The operator signs only the customer-confirmed packet.",
      steps: [
        "Open the filing packet. Confirm there are no blockers (open state questions, re-signing, payment).",
        "Sign in to ORION and find the entity by name or entity number.",
        "Check the due date and status. Filed after the due date, Nevada adds $75 (list) + $100 (business license): pay them only if the order collected them, otherwise contact the customer first.",
        p.corporation ? "Confirm the authorized-stock tier: only $75,000 or less ($150 list fee) is sold online." : "Confirm the list fee shown is $150.",
        "Go through the list in the order below and make every value match the packet. Leave the optional industry code and business identity questions as on record.",
        "Compare the review screen with the packet, then record the comparison checkpoint in Filewell.",
        "Sign the declaration as the customer's authorized filing agent, pay both fees by card, and save the filed list and the State Business License.",
      ],
      fieldMap: [
        { section: "Type of filing", portalField: "Annual List or Amended List", answerKey: null, note: "Annual List (filed within 90 days before the due date)" },
        { section: "State Business License", portalField: "Fee exemption", answerKey: "sbl_exemption" },
        { section: "Name of entity", portalField: "Entity name", answerKey: "legal_name" },
        { section: "Name of entity", portalField: "Entity number / NVID", answerKey: "entity_number" },
        { section: "Optional business information", portalField: "Industry codes; how the business identifies", answerKey: null, note: "Leave as on record (optional)" },
        { section: "Business location", portalField: "Business location in Nevada", answerKey: "principal_office" },
        ...(p.disclosure
          ? [
              { section: "Investigation disclosure", portalField: "Five or more trade-restraint investigations in 5 years", answerKey: "nv_trade_investigations" },
              { section: "Investigation disclosure", portalField: "25% or more market share in Nevada", answerKey: "nv_market_share" },
            ]
          : []),
        ...(p.corporation
          ? [
              { section: "Corporation", portalField: "Publicly traded?", answerKey: "publicly_traded" },
              { section: "Corporation", portalField: "Authorized stock tier", answerKey: "authorized_stock_tier" },
            ]
          : []),
        { section: "Entity management", portalField: p.corporation ? "Officers and directors (name, title, address)" : `${p.peopleLabel} (name, title, address)`, answerKey: "governors" },
        ...(p.entityType === "llc" ? [{ section: "Entity management", portalField: "Manager- or member-managed (foreign LLCs)", answerKey: "llc_management" }] : []),
        { section: "Contact", portalField: "Notice email", answerKey: "state_notice_email" },
        {
          section: "Declaration and signature",
          portalField: "Declaration under penalty of perjury and signature",
          answerKey: null,
          note: "Your own name, as the customer's authorized filing agent, only after the comparison checkpoint.",
        },
      ],
      confirmationLabel: "ORION filing / work order number",
      receipt: "The filed annual list and the State Business License (PDF).",
    },
    stateAuthorization: {
      certificationText: p.certification,
      certificationSourceFactKey: "certification",
      operatorCheckpoint: true,
    },
    sources: [p.dueQuote, p.listFeeQuote, p.listPenaltyQuote, p.contentsQuote, p.certificationSource, ...COMMON],
    lastVerifiedAt: VERIFIED_V2,
    verifiedBy: REVIEWER,
    notes: p.corporation
      ? "Annual list fee is tiered by authorized stock value (NRS 78.150(4)(b)); only the lowest tier ($150) is offered online. Publicly traded corporations are not offered."
      : undefined,
  };
}

export const NEVADA_RULES: ComplianceRuleDef[] = PROFILES.map(buildRule);

export const NEVADA_FACTS = {
  businessSearchUrl: NV_URLS.businessSearch,
  portalUrl: NV_URLS.portal,
  /** Public search and portal are bot-protected; Filewell does not automate them. */
  lookupMethod: "manual" as const,
};
