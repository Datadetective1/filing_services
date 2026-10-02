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
} as const;

function src(factKey: string, url: string, title: string, quote: string, publisher = LEG): RuleSource {
  return { factKey, url, title, publisher, quote, lastVerifiedAt: VERIFIED };
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
        ],
      },
      {
        key: "principal_office",
        title: "Place of business",
        description:
          "Nevada's state business license is issued for your place of business. If the business has no Nevada location, Nevada uses your registered agent's address.",
        fields: [{ key: "principal_office", type: "address", label: "Business address", required: true, noPoBox: true }],
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
    version: 1,
    verificationStatus: "verified",
    effectiveFrom: VERIFIED,
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
        "An ORION user account (existing SilverFlume credentials carry over); whether a guest can file without an account wasn't confirmed. The list is signed by an officer or 'some other person specifically authorized' and includes a declaration under penalty of perjury, so the operator signs only with the customer's explicit written authorization.",
      steps: [
        "Sign in to ORION and find the entity by name or entity number.",
        "Check the annual list due date and status. Filed after the due date, Nevada adds $75 (list) + $100 (business license): confirm the order covers it before paying.",
        p.corporation ? "Confirm the authorized-stock tier: only $75,000 or less ($150 list fee) is sold online." : "Confirm the list fee shown is $150.",
        "File the annual list with the people and addresses below, and renew the State Business License in the same filing.",
        "Complete the NRS 76 compliance declaration as authorized by the customer, then pay both fees by card.",
        "Save the filed list and the State Business License from the portal.",
      ],
      fieldMap: [
        { portalField: "Entity number / NV Business ID", answerKey: "entity_number" },
        { portalField: "Entity name", answerKey: "legal_name" },
        { portalField: p.corporation ? "Officers and directors (name, title, address)" : `${p.peopleLabel} (name, title, address)`, answerKey: "governors" },
        { portalField: "Business license: place of business", answerKey: "principal_office" },
        ...(p.corporation
          ? [
              { portalField: "Publicly traded?", answerKey: "publicly_traded" },
              { portalField: "Authorized stock tier", answerKey: "authorized_stock_tier" },
            ]
          : []),
        { portalField: "Notice email", answerKey: "state_notice_email" },
      ],
      confirmationLabel: "ORION filing / work order number",
      receipt: "The filed annual list and the State Business License (PDF).",
    },
    sources: [p.dueQuote, p.listFeeQuote, p.listPenaltyQuote, p.contentsQuote, ...COMMON],
    lastVerifiedAt: VERIFIED,
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
