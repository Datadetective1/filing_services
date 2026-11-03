import type { RaSource } from "./jurisdictions";

/** One entity type's annual report in one state. */
export interface ProviderReportEntityFacts {
  /** Whether the state requires a periodic report for this entity type. null = not verified. */
  required: boolean | null;
  /** The state's report fee, in cents, only when it is one fixed amount with nothing else owed with the report. */
  feeCents: number | null;
  /** Why there is no fee here (no report, a tax or a fee that varies), in plain words. */
  whyNotFixed: string | null;
}

export interface ProviderReportFacts {
  /** The state's own name for the report. */
  reportName: string;
  frequency: "annual" | "biennial";
  /** When it is due, in a few plain words. */
  due: string;
  llc: ProviderReportEntityFacts;
  corporation: ProviderReportEntityFacts;
  /** Operator notes (online fees, late fees, how the state files it). */
  notes: string[];
  unverified: string[];
  sources: RaSource[];
}

/**
 * Annual report facts for the states Filewell doesn't file itself, from each state's own filing
 * office site, checked on the date stored with each source. A fee is present only when the
 * official page states it as one fixed amount for that entity type, paid with the report with
 * no tax, license or portal fee added. Researched November 3, 2026. Generated from the research
 * notes; edit by hand only with a new official source.
 */
export const PROVIDER_REPORT_FACTS: Record<string, ProviderReportFacts> = {
  AK: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "By January 2 of the filing year (even years if formed in an even year, odd years if formed in an odd year); late after February 1",
    llc: { required: true, feeCents: 10000, whyNotFixed: null },
    corporation: { required: true, feeCents: 10000, whyNotFixed: null },
    notes: [
      "Late: $137.50 total ($37.50 late fee) if filed on or after February 2.",
    ],
    unverified: [
      "Corporation biennial report row on the Forms and Fees page shows $100.00 in a misaligned table cell; the FAQ page confirms $100.00 for for-profit corporations and LLCs.",
    ],
    sources: [
      {
        url: "https://www.commerce.alaska.gov/web/cbpl/Corporations/CorpFormsFees",
        publisher: "www.commerce.alaska.gov",
        quote:
          "Biennial Report (online) (file every two years to avoid non-compliance) | | $100.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.commerce.alaska.gov/web/cbpl/Corporations/BiennialReports",
        publisher: "www.commerce.alaska.gov",
        quote:
          "Biennial Reports are due by January 2nd, reports marked after February 1st incur late fee penalties.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.commerce.alaska.gov/web/cbpl/Corporations/BiennialReportsFAQs",
        publisher: "www.commerce.alaska.gov",
        quote: "$100.00 or $137.50 with late fee on or after February 2nd",
        checkedAt: "2026-11-03",
      },
    ],
  },
  AL: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Limited liability entities: no later than 2.5 months after the beginning of the taxable year (matches federal return due date)",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Alabama's annual filing is the Business Privilege Tax return filed with the Department of Revenue; the amount is a tax computed on net worth. For 2026, an entity whose tax would be $100 or less has no filing requirement.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The $10 Secretary of State annual report fee is paid with the Business Privilege Tax return, which is a tax computed on net worth (minimum tax rules apply).",
    },
    notes: [
      "Late: Late filing penalty: greater of 10% of the tax shown due or $50; late payment: 1% per month of tax due, up to 25%.",
    ],
    unverified: [
      "Name reservation fee ($25 / $28 online) comes from the SOS 2021 fee schedule PDF; not re-confirmed on a 2026 page.",
      "Exact wording of the 2023+ reduced minimum tax ($50 in lieu of $100) vs the 2026 Form PPT 'no filing requirement if $100 or less' rule was read from two different official pages; Revenue's main page wording may lag.",
    ],
    sources: [
      {
        url: "https://www.revenue.alabama.gov/tax-types/business-privilege-tax/",
        publisher: "www.revenue.alabama.gov",
        quote:
          "Minimum privilege tax is $100; plus the $10 Secretary of State annual report fee for corporations.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.revenue.alabama.gov/faqs/when-is-the-alabama-business-privilege-tax-return-due",
        publisher: "www.revenue.alabama.gov",
        quote:
          "no later than two and a half months after the beginning of the taxpayer's taxable year.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.revenue.alabama.gov/wp-content/uploads/2026/01/26fpptinstr.pdf",
        publisher: "www.revenue.alabama.gov",
        quote: "If $100 or less, STOP. You do not have a filing requirement.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  AR: {
    reportName: "Annual report",
    frequency: "annual",
    due: "On or before May 1",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The annual filing is a franchise tax report; the payment is a franchise tax (flat $150 for all LLCs per the 2024 form), not a report filing fee.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Franchise tax computed on Arkansas portion of issued capital stock x 0.003, minimum $150 ($300 for corporations without authorized stock).",
    },
    notes: [
      "Late: $25 late filing penalty plus daily interest (tax + penalty x 0.000274 x days late).",
    ],
    unverified: [
      "Franchise tax amounts and May 1 due date come from the 2024 LLC and 2020 corporation franchise tax forms on sos.arkansas.gov; a 2026 form was not read.",
    ],
    sources: [
      {
        url: "https://www.sos.arkansas.gov/uploads/LLC1_FT_2024.pdf",
        publisher: "www.sos.arkansas.gov",
        quote: "ALL LIMITED LIABILITY COMPANIES PAY $150.00 TOTAL DUE $150.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.arkansas.gov/uploads/Corp_FT_2020.pdf",
        publisher: "www.sos.arkansas.gov",
        quote: "MINIMUM TAX DUE $150 • IF LESS THAN $150 PAY $150",
        checkedAt: "2026-11-03",
      },
    ],
  },
  AZ: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By the corporation's assigned due date (set by the Arizona Corporation Commission)",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    corporation: { required: true, feeCents: 4500, whyNotFixed: null },
    notes: [
      "Optional expedited processing: $80 total for the annual report ($35 expedite fee).",
      "Late: Delinquency penalty of $9.00 per month for for-profit corporations once the deadline is missed.",
    ],
    unverified: [
      "Exact corporate annual report due-date rule beyond 'assigned due date' (commonly the incorporation anniversary) not stated on the official page read.",
      "County-population exception wording for corporations (A.R.S. 10-203) not fully read; only the LLC statute's 800,000-population exception was confirmed.",
    ],
    sources: [
      {
        url: "https://azcc.gov/corporations/faqs",
        publisher: "azcc.gov",
        quote:
          "No, LLCs are not required to file annual reports. Only corporations are required to file annual reports.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.azcc.gov/docs/default-source/corps-files/fee-schedules/fee-schedule-corporations6def4cc74b1a47129d16c2b1c3851bda.pdf",
        publisher: "www.azcc.gov",
        quote: "Annual Report, For-profit corporation $45.00 $80.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://azcc.gov/corporations/faqs/annual-reports",
        publisher: "azcc.gov",
        quote:
          "penalties in the amount of $9.00 per month begin to accrue when the deadline is missed.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  CA: {
    reportName: "Statement of Information",
    frequency: "biennial",
    due: "Within 90 days of initial registration, then every two years during the six-month filing period ending in the formation month",
    llc: { required: true, feeCents: 2000, whyNotFixed: null },
    corporation: { required: true, feeCents: 2500, whyNotFixed: null },
    notes: [
      "Late: Failure to file may result in penalties assessed by the Franchise Tax Board and suspension or forfeiture (amount not stated on the SOS page read). The separate $800 annual franchise tax is paid to the FTB, not with this statement.",
    ],
    unverified: [
      "Statutory late penalty amount for Statements of Information ($250 is commonly cited) not stated on the SOS pages read.",
      "Corporation SOI timing quote was paraphrased by the page reader ('due 90 days after registration, then yearly'); exact sentence not captured.",
    ],
    sources: [
      {
        url: "https://sos.ca.gov/business-programs/business-entities/forms/limited-liability-companies-california-domestic",
        publisher: "sos.ca.gov",
        quote:
          "Due within 90 days of initial registration and every two years thereafter.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ca.gov/business-programs/business-entities/forms/limited-liability-companies-statement-information",
        publisher: "www.sos.ca.gov",
        quote: "Statement of Information ... $20.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ca.gov/business-programs/business-entities/forms/corporations-california-domestic",
        publisher: "www.sos.ca.gov",
        quote:
          "Statement of Information - Domestic and Foreign Stock (SI-550) ... $25.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.ca.gov/business-programs/business-entities/statements/",
        publisher: "sos.ca.gov",
        quote:
          "may result in penalties being assessed by the Franchise Tax Board and suspension or forfeiture",
        checkedAt: "2026-11-03",
      },
    ],
  },
  CT: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Filed online between January 1 and March 31 each year",
    llc: { required: true, feeCents: 8000, whyNotFixed: null },
    corporation: { required: true, feeCents: 15000, whyNotFixed: null },
    notes: [
      "Late: No late fee stated on the pages read; the Secretary may administratively dissolve an entity that fails to file.",
    ],
    unverified: [
      "Corporation annual report due-date rule not stated on the official pages read (commonly the anniversary month).",
      "Late fee rules not stated on the pages read.",
      "An older SOTS PDF guide lists the LLC annual report at $20; the current business.ct.gov knowledge base lists $80, which was used.",
    ],
    sources: [
      {
        url: "https://business.ct.gov/knowledge-base/articles/domestic-annual-report-forms-and-fees",
        publisher: "business.ct.gov",
        quote:
          "Limited Liability Company (LLC) Annual Report (file online) $80",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://business.ct.gov/knowledge-base/articles/domestic-limited-liability-companies-forms-and-fees",
        publisher: "business.ct.gov",
        quote: "filed online annually from January 1 to March 31.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://business.ct.gov/knowledge-base/articles/domestic-stock-corporations-forms-and-fees",
        publisher: "business.ct.gov",
        quote: "Annual Report: $150",
        checkedAt: "2026-11-03",
      },
    ],
  },
  DC: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "First report by April 1 of the calendar year after registration, then by April 1 every two years",
    llc: { required: true, feeCents: 30000, whyNotFixed: null },
    corporation: { required: true, feeCents: 30000, whyNotFixed: null },
    notes: ["Late: Biennial report late fee $100.00."],
    unverified: [],
    sources: [
      {
        url: "https://dlcp.dc.gov/node/1621921",
        publisher: "dlcp.dc.gov",
        quote:
          "Domestic & Foreign Limited Liability Company | Biennial report | $300.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dlcp.dc.gov/node/1621906",
        publisher: "dlcp.dc.gov",
        quote: "Biennial report late fee: $100.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dlcp.dc.gov/page/corporations-division-business-registration-faqs",
        publisher: "dlcp.dc.gov",
        quote:
          "An entity's first Biennial Report is due by April 1st the very next calendar year after it registers",
        checkedAt: "2026-11-03",
      },
    ],
  },
  DE: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Annual tax due on or before June 1",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed:
        "No report is required. LLCs pay a flat annual tax of $400.00 (a tax, not a report fee).",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "$50 annual report filing fee is filed with the franchise tax, which depends on authorized shares (minimum $175 Authorized Shares Method) or assumed par value capital (minimum $400).",
    },
    notes: [
      "Late: $200 penalty plus 1.5% interest per month on tax and penalty (both LLC annual tax and corporate report/tax).",
    ],
    unverified: [
      "Delaware LLC annual tax is now $400.00 per the official instructions page (previously $300); confirm effective tax year if needed.",
    ],
    sources: [
      {
        url: "https://corp.delaware.gov/alt-entitytaxinstructions/",
        publisher: "corp.delaware.gov",
        quote: "There is no requirement to file an Annual Report.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://corp.delaware.gov/alt-entitytaxinstructions/",
        publisher: "corp.delaware.gov",
        quote: "an annual tax of $400.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://corp.delaware.gov/paytaxes/",
        publisher: "corp.delaware.gov",
        quote: "Non-Exempt Domestic Corporations – $50.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://corp.delaware.gov/paytaxes/",
        publisher: "corp.delaware.gov",
        quote:
          "The minimum tax is currently $175.00, using the Authorized Shares Method",
        checkedAt: "2026-11-03",
      },
    ],
  },
  GA: {
    reportName: "Annual registration",
    frequency: "annual",
    due: "Between January 1 and April 1 each year",
    llc: { required: true, feeCents: 6000, whyNotFixed: null },
    corporation: { required: true, feeCents: 6000, whyNotFixed: null },
    notes: [
      "The $60 is described as a $50 filing fee plus a $10 service charge; same total online and paper. Optional $60 expedite for mailed filings only.",
      "Late: $25.00 penalty for late filing of annual registration. Up to 3 years may be filed in advance.",
    ],
    unverified: [
      "Corporation publication requirement and its cost not confirmed on an official page (sos.ga.gov PDFs returned errors; official code not read).",
      "Late penalty $25.00 read from the fee table on the annual registration guide; the quote captures the row label, amount listed as $25.00.",
    ],
    sources: [
      {
        url: "https://sos.ga.gov/how-to-guide/how-guide-register-domestic-entity",
        publisher: "sos.ga.gov",
        quote: "The fee is $60.00 ($50 filing fee + $10 service charge).",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.ga.gov/how-to-guide/how-file-annual-registration",
        publisher: "sos.ga.gov",
        quote:
          "Entity annual registrations are due by April 1st of each year it is due, but may be filed as early as January 1st.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.ga.gov/how-to-guide/how-file-annual-registration",
        publisher: "sos.ga.gov",
        quote: "Penalty for Late Filing of Annual Registration",
        checkedAt: "2026-11-03",
      },
    ],
  },
  HI: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By the end of the calendar quarter in which the entity was registered (March 31, June 30, September 30 or December 31)",
    llc: { required: true, feeCents: 1250, whyNotFixed: null },
    corporation: { required: true, feeCents: 1250, whyNotFixed: null },
    notes: [
      "Online filing is cheaper: $12.50 instead of $15.00 for both LLCs and profit corporations. Optional $25 expedite.",
      "Late: Online: $10.00 late fee per year delinquent; statute allows up to $100 per 30-day period of delinquency.",
    ],
    unverified: [
      "Whether the $1.00 State Archives fee applies to articles of organization/incorporation is not stated on the official schedule.",
      "Annual report fee_cents uses the $15.00 standard fee; online filing is $12.50.",
    ],
    sources: [
      {
        url: "https://cca.hawaii.gov/breg/registration/dllc/fees/",
        publisher: "cca.hawaii.gov",
        quote: "Annual Report | $15.00 | $25.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://cca.hawaii.gov/breg/files/2023/03/LLC-INFO_3-2023.pdf",
        publisher: "cca.hawaii.gov",
        quote:
          "Online filing fee for Limited Liability Company Annual Report: $12.50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://cca.hawaii.gov/wp-content/uploads/2026/01/DC-INFO_3-2023.pdf",
        publisher: "cca.hawaii.gov",
        quote:
          "Online filing fee for Domestic Profit Corporation Annual Report: $12.50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://cca.hawaii.gov/wp-content/uploads/2026/01/DC-INFO_3-2023.pdf",
        publisher: "cca.hawaii.gov",
        quote: "a $10.00 late fee will be assessed per year delinquent",
        checkedAt: "2026-11-03",
      },
    ],
  },
  IA: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "Between January 1 and April 1 of each odd-numbered year",
    llc: { required: true, feeCents: 3000, whyNotFixed: null },
    corporation: { required: true, feeCents: 6000, whyNotFixed: null },
    notes: [],
    unverified: [
      "Late-filing consequence/fee not stated on pages read.",
      "Corporation biennial fee: HF 997 status not confirmed; current Code (Iowa Code 2026) and SOS help page say $60.",
      "Certificate of organization quote is from a statute table row (label + amount).",
    ],
    sources: [
      {
        url: "https://help.sos.iowa.gov/how-do-i-file-biennial-report",
        publisher: "help.sos.iowa.gov",
        quote:
          "If you file your Biennial Report online through Fast Track Filing, your filing fee will be $30.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://help.sos.iowa.gov/how-do-i-file-biennial-report",
        publisher: "help.sos.iowa.gov",
        quote:
          "If you have a for-Profit Corporation (Inc.), your filing fee will be $60.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.legis.iowa.gov/docs/iac/rule/02-05-2025.721.40.7.pdf",
        publisher: "www.legis.iowa.gov",
        quote:
          "The fee for filing and indexing a biennial report filed on paper or in a paper-based format is $45.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.legis.iowa.gov/docs/code/490.122.pdf",
        publisher: "www.legis.iowa.gov",
        quote:
          "ad. Biennial report............................................................ $ 60",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.legis.iowa.gov/docs/code/489.212.pdf",
        publisher: "www.legis.iowa.gov",
        quote:
          "A subsequent biennial report must be delivered to the secretary of state between January 1 and April 1",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.legis.iowa.gov/docs/code/490.1621.pdf",
        publisher: "www.legis.iowa.gov",
        quote:
          "must be delivered to the secretary of state between January 1 and April 1 of the following even-numbered calendar years.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  ID: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By the end of the month in which the entity was formed (anniversary month)",
    llc: { required: true, feeCents: 0, whyNotFixed: null },
    corporation: { required: true, feeCents: 0, whyNotFixed: null },
    notes: [
      "Paper filings that require manual data entry carry a $20 surcharge; annual reports are normally filed online at SOSBiz and paper forms are by request only.",
      "Late: No late fee found; failure to file leads to administrative dissolution (not stated on the pages read).",
    ],
    unverified: [
      "'No fee' for the annual report comes from the 2017 enacted bill H0054 amending Idaho Code 30-21-214; the current statute page did not render its fee amounts, and no SOS page stating the annual report fee was found.",
      "Late-filing consequences not read on an official page.",
    ],
    sources: [
      {
        url: "https://legislature.idaho.gov/wp-content/uploads/sessioninfo/2017/legislation/H0054.pdf",
        publisher: "legislature.idaho.gov",
        quote: "Annual report ... No fee",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://legislature.idaho.gov/statutesrules/idstat/Title30/T30CH21/SECT30-21-213/",
        publisher: "legislature.idaho.gov",
        quote:
          "not later than the close of business on the final day of the applicable month",
        checkedAt: "2026-11-03",
      },
    ],
  },
  IL: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Not verified",
    llc: { required: true, feeCents: 7500, whyNotFixed: null },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The corporate annual report is filed with franchise tax computed on paid-in capital; the total depends on capital.",
    },
    notes: [
      "Optional in-person expedited service: $50 additional for the LLC annual report.",
    ],
    unverified: [
      "LLC annual report due-date rule and late penalty not read on an official page (ilsos.gov guides and ilga.gov statutes failed to load).",
      "Corporation annual report name/fee/due date and franchise tax rules not read on an official page; corporation value null.",
      "Corporation formation fee not read on an official page.",
    ],
    sources: [
      {
        url: "https://www.ilsos.gov/publications/business-services/llc.html",
        publisher: "www.ilsos.gov",
        quote: "LLC 50.1 Limited Liability Company Annual Report $75 $50",
        checkedAt: "2026-11-03",
      },
    ],
  },
  IN: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "Every other year, by the end of the anniversary month of formation (may file up to 90 days early)",
    llc: { required: true, feeCents: 3100, whyNotFixed: null },
    corporation: { required: true, feeCents: 3100, whyNotFixed: null },
    notes: [
      "Online price ($31) already includes the state's enhanced-access fee ($20 statutory + $11 per 75 IAC 8-3-10); it is cheaper than mail ($50). No further convenience fee found.",
      "Late: No late fee stated; entity is administratively dissolved after the report is five months overdue.",
    ],
    unverified: [
      "No single official page found that states the $95 online formation total; derived from statute ($75) + enhanced access fee rule ($20).",
      "Enhanced-access fee amounts quoted from a table summary, not a sentence.",
    ],
    sources: [
      {
        url: "https://www.in.gov/sos/business/business-entity-reports",
        publisher: "www.in.gov",
        quote: "For Profit Online: $31",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.in.gov/sos/business/business-entity-reports",
        publisher: "www.in.gov",
        quote: "For Profit by Mail: $50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.in.gov/sos/business/business-entity-reports",
        publisher: "www.in.gov",
        quote:
          "After five months of a business entity report being overdue, the business will be administratively dissolved.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://iga.in.gov/ic/2026/Title_23/Article_0.5/Chapter_9.pdf",
        publisher: "iga.in.gov",
        quote: "Twenty dollars ($20), in the case of a for-profit entity.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  KS: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By the 15th day of the 4th month after the tax year end (Jan 1 - Apr 15 for a December year end)",
    llc: { required: true, feeCents: 5300, whyNotFixed: null },
    corporation: { required: true, feeCents: 5300, whyNotFixed: null },
    notes: [],
    unverified: [
      "Late fee / forfeiture rule not stated on the forms read.",
      "Corporation online formation quote is a fee-table row (label + amount).",
    ],
    sources: [
      {
        url: "https://sos.ks.gov/forms/business_services/LC.pdf",
        publisher: "sos.ks.gov",
        quote: "Online Annual Report: ... $53",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.ks.gov/forms/business_services/LC.pdf",
        publisher: "sos.ks.gov",
        quote: "Paper Annual Report:.... $55",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ks.gov/forms/business_services/ar.pdf",
        publisher: "www.sos.ks.gov",
        quote: "Online Annual Report: ................................... $53",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ks.gov/forms/business_services/ar.pdf",
        publisher: "www.sos.ks.gov",
        quote:
          "the annual report due date period would be between January 1st and April 15th after each December",
        checkedAt: "2026-11-03",
      },
    ],
  },
  KY: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Between January 1 and June 30 each year",
    llc: { required: true, feeCents: 1500, whyNotFixed: null },
    corporation: { required: true, feeCents: 1500, whyNotFixed: null },
    notes: [
      "Late: No late fee; domestic entities not filed by June 30 are administratively dissolved; reinstatement penalty $100 plus delinquent fees.",
    ],
    unverified: [],
    sources: [
      {
        url: "https://www.sos.ky.gov/bus/business-filings/Pages/Fees.aspx",
        publisher: "www.sos.ky.gov",
        quote: "Annual Report: $15.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ky.gov/bus/business-filings/Pages/Annual-Reports.aspx",
        publisher: "www.sos.ky.gov",
        quote: "accompanied by a $15 filing fee.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ky.gov/bus/business-filings/Pages/Annual-Reports.aspx",
        publisher: "www.sos.ky.gov",
        quote:
          "Domestic entities that fail to file their annual reports by June 30 are administratively dissolved.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ky.gov/bus/business-filings/Pages/Fees.aspx",
        publisher: "www.sos.ky.gov",
        quote:
          "Reinstatement penalty after administrative dissolution: $100.00",
        checkedAt: "2026-11-03",
      },
    ],
  },
  LA: {
    reportName: "Annual report",
    frequency: "annual",
    due: "On or before the anniversary date of organization",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Card payments add a $5 state convenience fee, so the amount charged depends on how it is paid.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Card payments add a $5 state convenience fee, so the amount charged depends on how it is paid.",
    },
    notes: ["Credit card payments add a $5 statutory convenience fee."],
    unverified: [
      "sos.la.gov pages (FAQ, LLC form 365) blocked by robots; used static.sos.la.gov fee schedule and statute.",
      "Corporation annual report due-date rule not read from statute; stated by analogy to LLC (anniversary date).",
      "Late fee not listed on fee schedule.",
      "Whether a corporation initial report carries a separate fee not confirmed (schedule shows none).",
    ],
    sources: [
      {
        url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
        publisher: "static.sos.la.gov",
        quote: "Annual Report $35",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
        publisher: "static.sos.la.gov",
        quote: "Annual Reports $35",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
        publisher: "static.sos.la.gov",
        quote:
          "Credit card payments are subject to an additional statutory convenience fee. $5",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://legis.la.gov/legis/Law.aspx?d=76256",
        publisher: "legis.la.gov",
        quote:
          "On or before the anniversary date of organization of each limited liability company,",
        checkedAt: "2026-11-03",
      },
    ],
  },
  MA: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By the anniversary of the LLC's original filing",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Electronic filings may add an expedited service fee; the state page does not say when.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Electronic filings may add an expedited service fee; the state page does not say when.",
    },
    notes: [
      "Secretary's fee page lists an 'expedited service fee' table for fax and electronic filings ($3 under $15 up to $20 at $500, 4.5% above $500); page does not say whether it applies to all online filings.",
      "Late: Corporation: $150 if not filed timely (vs $125). LLC: none listed.",
    ],
    unverified: [
      "Whether the electronic 'expedited service fee' is mandatory on every online filing is unclear from the page.",
    ],
    sources: [
      {
        url: "https://www.sec.state.ma.us/divisions/corporations/general-information/corporations-filing-fees.htm",
        publisher: "www.sec.state.ma.us",
        quote:
          "$125.00; $150 if not filed timely ($100 if filed electronically)",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sec.state.ma.us/divisions/corporations/download/c156c512cdllcannual.pdf",
        publisher: "www.sec.state.ma.us",
        quote: "Filing fee: $500",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.mass.gov/info-details/starting-a-limited-liability-company-llc-in-massachusetts",
        publisher: "www.mass.gov",
        quote: "The filing fee is $500.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.mass.gov/info-details/starting-a-corporation-in-massachusetts",
        publisher: "www.mass.gov",
        quote: "2½ months after close of fiscal year",
        checkedAt: "2026-11-03",
      },
    ],
  },
  MD: {
    reportName: "Annual report",
    frequency: "annual",
    due: "April 15 each year",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The state portal may add a 3% service fee; not confirmed for annual reports.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The state portal may add a 3% service fee; not confirmed for annual reports.",
    },
    notes: [
      "Maryland Business Express charges a 3% service/convenience fee on portal payments (stated on SDAT charter fee schedule; not confirmed for annual reports).",
      "Late: Late return: initial penalty of 1/10 of 1% of the county assessment plus 2% of that penalty per 30 days late.",
    ],
    unverified: [
      "That personal property tax is billed separately (not with the report) is not stated on the form read.",
      "Whether the 3% Business Express fee applies to annual report payments not confirmed.",
    ],
    sources: [
      {
        url: "https://dat.maryland.gov/SiteAssets/Pages/sdatforms/2026_Form1%20Final%20(6).pdf",
        publisher: "dat.maryland.gov",
        quote: "Domestic or Foreign Stock Corporation (D) or (F) $300",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dat.maryland.gov/SiteAssets/Pages/sdatforms/2026_Form1%20Final%20(6).pdf",
        publisher: "dat.maryland.gov",
        quote: "Domestic or Foreign Limited Liability Company (W) or (Z) $300",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dat.maryland.gov/SiteAssets/Pages/sdatforms/2026_Form1%20Final%20(6).pdf",
        publisher: "dat.maryland.gov",
        quote:
          "will receive an initial penalty of 1/10 of one percent of the county assessment",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dat.maryland.gov/businesses/documents/fees.pdf",
        publisher: "dat.maryland.gov",
        quote:
          "includes a 3% service/convenience fee for payments processed through the Maryland Business Express portal",
        checkedAt: "2026-11-03",
      },
    ],
  },
  ME: {
    reportName: "Annual report",
    frequency: "annual",
    due: "June 1 each year",
    llc: { required: true, feeCents: 8500, whyNotFixed: null },
    corporation: { required: true, feeCents: 8500, whyNotFixed: null },
    notes: [
      "Late: LLC: $50 added for failing to file by the due date (31 MRSA s.1680); corporations: SOS says a substantial late penalty applies after June 1 (amount not read).",
    ],
    unverified: [
      "Corporation late-penalty amount not read from statute.",
      "Corporation quotes are fee-table rows (label + amount).",
    ],
    sources: [
      {
        url: "https://legislature.maine.gov/statutes/31/title31sec1680.html",
        publisher: "legislature.maine.gov",
        quote:
          "For filing of an annual report under section 1665, a fee of $85 for a limited liability company",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.maine.gov/sos/news/annual-reports-business-and-nonprofit-entities-are-due-june-1-1",
        publisher: "www.maine.gov",
        quote: "The annual report fee is $85 for domestic business entities",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.maine.gov/sos/corporations-commissions/corporations-business-services/business-corporations",
        publisher: "www.maine.gov",
        quote: "Annual Report - Domestic (MBCA 13) $85.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://legislature.maine.gov/statutes/31/title31sec1680.html",
        publisher: "legislature.maine.gov",
        quote:
          "For failing to deliver an annual report by its due date, in addition to the annual report filing fee, a fee of $50",
        checkedAt: "2026-11-03",
      },
    ],
  },
  MN: {
    reportName: "Annual renewal",
    frequency: "annual",
    due: "By December 31 each calendar year (starting the year after formation)",
    llc: { required: true, feeCents: 0, whyNotFixed: null },
    corporation: { required: true, feeCents: 0, whyNotFixed: null },
    notes: [
      "Late: No late fee; non-filers are administratively dissolved/terminated. Reinstatement $65 by mail / $85 online (fee schedule); statute cites a $25 reinstatement fee.",
    ],
    unverified: [
      "SOS fee schedule amounts ($135 mail / $155 online, $65/$85 reinstatement) read from a table; no verbatim sentence.",
      "302A.153 page displayed the 2025 statute edition.",
    ],
    sources: [
      {
        url: "https://www.revisor.mn.gov/statutes/cite/322C.0208",
        publisher: "www.revisor.mn.gov",
        quote: "no fee is required to file an annual renewal",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.revisor.mn.gov/statutes/cite/302A.821",
        publisher: "www.revisor.mn.gov",
        quote:
          "must file with the secretary of state by December 31 of each calendar year",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.mn.gov/business-liens/business-filing-and-certification-fee-schedule/",
        publisher: "www.sos.mn.gov",
        quote: "Domestic corporation / LLC annual renewal: $0 (fee table row)",
        checkedAt: "2026-11-03",
      },
    ],
  },
  MO: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "By the end of the anniversary month of incorporation",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "Missouri LLCs do not file an annual report.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Electronic payments add a convenience fee of an unstated amount.",
    },
    notes: [
      "Electronic payments (card/eCheck) incur a small convenience fee not kept by the state (amount not stated).",
      "Late: Corporation: additional $15 for each 30-day period late.",
    ],
    unverified: [
      "Fee table rows quoted as label + amount.",
      "Convenience fee amount not stated.",
    ],
    sources: [
      {
        url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf",
        publisher: "www.sos.mo.gov",
        quote: "Annual Registration Report Filed Timely (on-line) $20.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf",
        publisher: "www.sos.mo.gov",
        quote: "Annual Registration Report Filed Timely (paper) $45.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.mo.gov/business/corporations/filings",
        publisher: "www.sos.mo.gov",
        quote:
          "Late reports are subject to an additional fee of $15 for each 30-day period.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.mo.gov/business/corporations/filings",
        publisher: "www.sos.mo.gov",
        quote:
          "the annual report is due at the end of the month that the corporation incorporated or qualified",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.mo.gov/business/faqs",
        publisher: "www.sos.mo.gov",
        quote:
          "Do limited liability companies have to file an annual report? No.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  MS: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By April 15 each year",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Reports are filed online and the portal may add a convenience fee of an unstated amount.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Reports are filed online and the portal may add a convenience fee of an unstated amount.",
    },
    notes: [
      "Reports must be filed online; e-gov portal may add a convenience fee (amount not stated).",
      "Late: No late fee listed; failure to file may lead to administrative dissolution.",
    ],
    unverified: ["Portal convenience fee amount not stated."],
    sources: [
      {
        url: "https://www.sos.ms.gov/content/documents/Business/FeeSchedule.pdf",
        publisher: "www.sos.ms.gov",
        quote: "Annual Report $25",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ms.gov/content/documents/Business/FeeSchedule.pdf",
        publisher: "www.sos.ms.gov",
        quote: "MS LLC Annual Report $0",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ms.gov/business-services/annual-reports",
        publisher: "www.sos.ms.gov",
        quote: "due by April 15th of that year",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.ms.gov/business-services/annual-reports",
        publisher: "www.sos.ms.gov",
        quote:
          "Failure to file the Annual Report may result in the administrative dissolution of the organization.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NC: {
    reportName: "Annual report",
    frequency: "annual",
    due: "April 15 each year after the year of creation",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The corporation fee is $18 online or $25 on paper, and online card payments add $3.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The corporation fee is $18 online or $25 on paper, and online card payments add $3.",
    },
    notes: ["Electronic filing fee of $3.00 for credit cards ($2.00 for ACH)."],
    unverified: [
      "NC corporation annual report has two statutory amounts (paper $25 / electronic $18); fee_cents uses paper. No late fee stated on the pages read.",
      "www.sosnc.gov main fee page sometimes refused; sosnc.gov and b2b.sosnc.gov pages used.",
    ],
    sources: [
      {
        url: "https://sosnc.gov/fees/by_title/_Business_Registration/",
        publisher: "sosnc.gov",
        quote: "Annual Report $200.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sosnc.gov/fees/by_title/_Business_Registration/",
        publisher: "sosnc.gov",
        quote: "Annual Report (effective September 1, 2007) $25.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_55/GS_55-1-22.html",
        publisher: "www.ncleg.gov",
        quote: "(23a) Annual report (electronic) 18.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://b2b.sosnc.gov/frequently_asked_questions/by_title/_BRD_FAQ_Annual_Reports",
        publisher: "b2b.sosnc.gov",
        quote: "Fee includes a $3.00 electronic filing fee for credit cards.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://b2b.sosnc.gov/frequently_asked_questions/by_title/_BRD_FAQ_Annual_Reports",
        publisher: "b2b.sosnc.gov",
        quote:
          "Your report is due on April 15th of each year after the year of creation.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  ND: {
    reportName: "Annual report",
    frequency: "annual",
    due: "November 15",
    llc: { required: true, feeCents: 5000, whyNotFixed: null },
    corporation: { required: true, feeCents: 2500, whyNotFixed: null },
    notes: [
      "Late: A late filing fee applies if not received by the deadline; amount not stated on the pages read.",
    ],
    unverified: [
      "ND late fee amounts not stated on the SOS fee pages; ND Century Code fee sections could not be reached in the fetched text.",
    ],
    sources: [
      {
        url: "https://sos.nd.gov/business/business-services/business-structures/limited-liability-companies/limited-liability-company-llc/llc-fees.html",
        publisher: "sos.nd.gov",
        quote: "Annual Report (domestic and foreign) - $50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nd.gov/business/business-services/business-structures/limited-liability-companies/limited-liability-company-llc/llc-fees.html",
        publisher: "sos.nd.gov",
        quote: "Filing Deadline - November 15",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nd.gov/business/business-services/business-structures/corporations/general-business-corporation/general-business-corporation-fees.html",
        publisher: "sos.nd.gov",
        quote: "Annual Report (domestic and foreign) - $25",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nd.gov/business/business-services/business-structures/corporations/general-business-corporation/general-business-corporation-fees.html",
        publisher: "sos.nd.gov",
        quote: "Filing Deadline (domestic) - August 1",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.nd.gov/business/business-services/maintain-registration",
        publisher: "www.sos.nd.gov",
        quote:
          "Annual reports must be received on or before the deadline or incur a late filing fee.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NE: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "Odd-numbered years, by April 1 (delinquent June 16)",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The amount comes from the general LLC filing fee statute; no Nebraska report page states the report fee.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Occupation tax is paid with the report and is based on paid-up capital stock (minimum $26 for up to $10,000).",
    },
    notes: [
      "Late: No late fee listed; non-filers are administratively dissolved; late reinstatement application $500 (plus report fee).",
    ],
    unverified: [
      "LLC biennial report fee rests on the general LLC Act fee in 21-192(1); no SOS page states the biennial report fee directly (reinstatement form confirms $30 paper).",
    ],
    sources: [
      {
        url: "https://nebraskalegislature.gov/laws/statutes.php?statute=21-192&print=true",
        publisher: "nebraskalegislature.gov",
        quote: "shall be thirty dollars if the filing is submitted in writing",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://nebraskalegislature.gov/laws/statutes.php?statute=21-192&print=true",
        publisher: "nebraskalegislature.gov",
        quote:
          "and twenty-five dollars if the filing is submitted electronically pursuant to section 84-511,",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nebraska.gov/sites/default/files/doc/business-services/Corporations/Reinstatement/DLLCReinstatement.pdf",
        publisher: "sos.nebraska.gov",
        quote: "PAPER FILING FEE: $30.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nebraska.gov/business-services/annualbiennial-reporting",
        publisher: "sos.nebraska.gov",
        quote: "due in the odd numbered years by April 1, delinquent June 16",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.nebraska.gov/business-services/annualbiennial-reporting",
        publisher: "sos.nebraska.gov",
        quote: "due in the even numbered years by March 1, delinquent April 15",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://nebraskalegislature.gov/laws/statutes.php?statute=21-303&print=true",
        publisher: "nebraskalegislature.gov",
        quote:
          "The minimum occupation tax for filing such report shall be twenty-six dollars.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NH: {
    reportName: "Annual report",
    frequency: "annual",
    due: "on or before April 1 each year (after the year of formation)",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Electronic payments add a $2 charge, so the amount depends on how it is paid.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Electronic payments add a $2 charge, so the amount depends on how it is paid.",
    },
    notes: [
      "$2.00 handling charge on all fees received electronically.",
      "Late: $50 additional late filing fee if not filed/paid on or before April 1.",
    ],
    unverified: [
      "NH SOS corporation forms-and-fees HTML page could not be fetched (site error / robots); statute and Form 11 used instead.",
    ],
    sources: [
      {
        url: "https://gc.nh.gov/rsa/html/XXVIII/304-C/304-C-191.htm",
        publisher: "gc.nh.gov",
        quote:
          "(f) Upon receipt for filing of an annual report under RSA 304-C:194, a fee in the amount of $100;",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://gc.nh.gov/rsa/html/xxvii/293-a/293-a-mrg.htm",
        publisher: "gc.nh.gov",
        quote: "(8) Annual report $ 100",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://gc.nh.gov/rsa/html/xxvii/293-a/293-a-mrg.htm",
        publisher: "gc.nh.gov",
        quote: "(17) Late filing $50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.nh.gov/corporations-0/forms-and-fees/limited-liability-companies",
        publisher: "www.sos.nh.gov",
        quote:
          "all fees received electronically by the State of New Hampshire will be charged an additional $2.00 handling charge",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NJ: {
    reportName: "Annual report",
    frequency: "annual",
    due: "by the last day of the anniversary month of formation",
    llc: { required: true, feeCents: 7500, whyNotFixed: null },
    corporation: { required: true, feeCents: 7500, whyNotFixed: null },
    notes: [
      "Late: No fixed late fee found; failure to file can lead to revocation (business.nj.gov).",
    ],
    unverified: [
      "NJ formation fee: official pages disagree ($100 vs $125, the $125 document revised 08/2025).",
      "Annual report due-date wording paraphrased from business.nj.gov; quoted fee lines are table rows from the DORES fee page.",
    ],
    sources: [
      {
        url: "https://www.nj.gov/treasury/revenue/fees.shtml",
        publisher: "www.nj.gov",
        quote:
          "Annual Report - corporate and LP (Expediting is not available on this item.) $75.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.nj.gov/treasury/revenue/fees.shtml",
        publisher: "www.nj.gov",
        quote: "Annual Report $75.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.nj.gov/treasury/revenue/pdf/Notice-Filing-Fees7-1-19-r4.pdf",
        publisher: "www.nj.gov",
        quote:
          "Annual Report filing fee changes from $50 to $75 for all Annual Reports due on or after July 1, 2019.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://business.nj.gov/pages/filings-and-accounting",
        publisher: "business.nj.gov",
        quote: "Failure to file can result in the revocation of your business.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NM: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "on or before the 15th day of the third month following the end of the taxable year",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    corporation: { required: true, feeCents: 2500, whyNotFixed: null },
    notes: [
      "Late: $200 late filing penalty if a report is filed untimely (12.3.2 NMAC).",
    ],
    unverified: [
      "NM LLC formation fee not reconfirmed today: businessportal.nm.gov LLC page returned an upstream error and NMSA 53-19-63 text could not be reached; only 2015 bill text shows $50.",
      "$200 late penalty is from 12.3.2 NMAC (a Public Regulation Commission-era rule hosted by State Records Center); current SOS practice not separately confirmed.",
    ],
    sources: [
      {
        url: "https://businessportal.nm.gov/maintain/file-reports/",
        publisher: "businessportal.nm.gov",
        quote:
          "This requirement does not apply to limited liability companies.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://businessportal.nm.gov/maintain/file-reports/file-corporation-report/",
        publisher: "businessportal.nm.gov",
        quote:
          "on or before the 15th day of the third month following the business's taxable year",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.nmonesource.com/nmos/nmsa/en/4400/1/document.do",
        publisher: "www.nmonesource.com",
        quote:
          "filing a corporate report and filing a supplemental report, a fee of twenty-five dollars ($25.00);",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.srca.nm.gov/parts/title12/12.003.0002.html",
        publisher: "www.srca.nm.gov",
        quote:
          "A $200.00 late filing penalty is required if a report is filed untimely.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NV: {
    reportName: "Annual renewal",
    frequency: "annual",
    due: "by the renewal (anniversary) date; may be filed within 90 days before it",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "A mandatory State Business License fee is paid with the annual list, so the total is not a single list fee.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "List fee is tiered on authorized shares x par value ($150 for $75,000 or less, rising to a max of $11,125) and a mandatory $500 State Business License fee is paid with it.",
    },
    notes: [
      "Corporation formation instructions note a 2.5% credit card processing fee (not included in listed fees).",
      "Late: Corporation list instructions: $75 late fee for the annual list and $100 late fee for the business license. LLC list instructions do not state late fees.",
    ],
    unverified: [
      "Quotes from bizhub.nv.gov PDFs were read through a text extractor; corporation list-fee tier rows were laid out out of order in the PDF text.",
      "LLC annual-list late fee not stated in the LLC (non-corp) instructions; corporation late fees ($75 list / $100 license) shown only in the corporation instructions.",
      "nvsos.gov HTML pages returned no body text to the fetcher; bizhub.nv.gov (official Nevada SOS business portal) PDFs used instead.",
    ],
    sources: [
      {
        url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/Annual_List_and_State_Business_License_Non_Corps_Final_6904713d13.pdf",
        publisher: "bizhub.nv.gov",
        quote:
          "The fee is $150.00, unless your entity is an LLLP under NRS Chapter 88, and then the fee is $200.00.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/Annual_List_and_State_Business_License_Non_Corps_Final_6904713d13.pdf",
        publisher: "bizhub.nv.gov",
        quote:
          "In addition, you must pay the $200.00 State Business License fee.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/Annual_List_and_State_Business_License_Corps_Final_2aebeed395.pdf",
        publisher: "bizhub.nv.gov",
        quote:
          "there is a State Business License fee of $500.00 for profit corporations",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/Annual_List_and_State_Business_License_Corps_Final_2aebeed395.pdf",
        publisher: "bizhub.nv.gov",
        quote:
          "you will owe a $75.00 late fee for the annual list and $100.00 late fee for the business license",
        checkedAt: "2026-11-03",
      },
    ],
  },
  NY: {
    reportName: "Biennial statement",
    frequency: "biennial",
    due: "every two years, during the calendar month of the original filing",
    llc: { required: true, feeCents: 900, whyNotFixed: null },
    corporation: { required: true, feeCents: 900, whyNotFixed: null },
    notes: [],
    unverified: [
      "NY biennial statement late fee: none stated on the DOS page.",
    ],
    sources: [
      {
        url: "https://dos.ny.gov/biennial-statements-business-corporations-and-limited-liability-companies",
        publisher: "dos.ny.gov",
        quote:
          "The fee for filing a Biennial Statement for a business corporation or LLC is $9.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dos.ny.gov/biennial-statements-business-corporations-and-limited-liability-companies",
        publisher: "dos.ny.gov",
        quote: "The Biennial Statement must be filed every two years.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  OH: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Not verified",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    corporation: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    notes: [],
    unverified: [
      "Ohio 'no annual report' is inferred: neither ORC 111.16 nor the LSC 01/30/2026 SOS fee list contains any annual report fee for for-profit corporations or LLCs (only nonprofit continued-existence and LLP/PA biennial reports). ohiosos.gov pages could not be fetched to quote an explicit statement.",
      "The LSC fee table shows a $125 minimum for some share tiers while ORC 111.16 says no fee is less than $99; irrelevant to the null result.",
    ],
    sources: [
      {
        url: "https://www.lsc.ohio.gov/assets/organizations/legislative-service-commission/files/2026-state-agency-fees-sos.pdf",
        publisher: "www.lsc.ohio.gov",
        quote: "Secretary of State Agency Fees - 01/30/2026",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://codes.ohio.gov/ohio-revised-code/section-111.16",
        publisher: "codes.ohio.gov",
        quote:
          "(F) For filing and recording articles of organization of a limited liability company",
        checkedAt: "2026-11-03",
      },
    ],
  },
  OK: {
    reportName: "Annual certificate",
    frequency: "annual",
    due: "on the anniversary date of filing the articles of organization; loses good standing if not filed within 60 days after due",
    llc: { required: true, feeCents: 2500, whyNotFixed: null },
    corporation: {
      required: false,
      feeCents: null,
      whyNotFixed:
        "No SOS annual report exists for domestic corporations; annual obligations run through the Oklahoma Tax Commission (franchise tax return), not a fixed SOS filing fee.",
    },
    notes: [
      "18 O.S. 1142(G): SOS may add a convenience fee up to 4% for card payments made electronically or by phone.",
      "Late: LLC: no late fee in statute; ceases to be in good standing 60 days after the due date (reinstatement required).",
    ],
    unverified: [
      "sos.ok.gov pages/PDFs blocked to the fetcher; official statutes on oscn.net (Oklahoma Supreme Court Network) used instead.",
      "Oklahoma corporation franchise tax status/amount and whether the $100 registered-agent fee applies only when SOS is the agent were not verified on an OTC page.",
    ],
    sources: [
      {
        url: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=365007",
        publisher: "www.oscn.net",
        quote:
          "shall file a certificate each year in the Office of the Secretary of State, which confirms it is an active business and includes its principal place of business address and electronic mail address, and shall pay an annual certificate fee of Twenty-five Dollars ($25.00).",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=365007",
        publisher: "www.oscn.net",
        quote:
          "The annual certificate shall be due on the anniversary date of filing the articles of organization",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=67153",
        publisher: "www.oscn.net",
        quote:
          "18. For acting as the registered agent, a fee of One Hundred Dollars ($100.00) payable on the first day of July each year",
        checkedAt: "2026-11-03",
      },
    ],
  },
  OR: {
    reportName: "Annual report",
    frequency: "annual",
    due: "by the anniversary (renewal due) date each year",
    llc: { required: true, feeCents: 10000, whyNotFixed: null },
    corporation: { required: true, feeCents: 10000, whyNotFixed: null },
    notes: [],
    unverified: [
      "The SOS fee schedule PDF (07/13) text is jumbled; the domestic corporation renewal amount was taken from ORS 56.140(2) ($100), with $275 applying to foreign entities under 56.140(3).",
      "No Oregon late fee found on the pages read.",
    ],
    sources: [
      {
        url: "https://www.oregonlegislature.gov/bills_laws/ors/ors056.html",
        publisher: "www.oregonlegislature.gov",
        quote:
          "a nonrefundable fee of $100 for annual reports delivered for filing by an entity",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.oregon.gov/business/Documents/business-registry-forms/br-fee-schedule.pdf",
        publisher: "sos.oregon.gov",
        quote: "Renewal (Annually) $100.00",
        checkedAt: "2026-11-03",
      },
    ],
  },
  RI: {
    reportName: "Annual report",
    frequency: "annual",
    due: "filing window February 1 - May 1",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Online filing adds $2.50, so the amount depends on how it is filed.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Online filing adds $2.50, so the amount depends on how it is filed.",
    },
    notes: [
      "$2.50 Enhanced Access online fee ($3.00 on a late filing).",
      "Late: $25 penalty added June 1 (report with penalty totals $75).",
    ],
    unverified: [
      "RI fee schedule PDF shows no revision date; Form 100 is revised 03/2026.",
    ],
    sources: [
      {
        url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
        publisher: "docs.sos.ri.gov",
        quote: "630 ANNUAL REPORT YES $50.00 $2.50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
        publisher: "docs.sos.ri.gov",
        quote: "632 ANNUAL REPORT YES $50.00 $2.50",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
        publisher: "docs.sos.ri.gov",
        quote: "630 ANNUAL REPORT – PENALTY IMPOSED YES $75.00 $3.00",
        checkedAt: "2026-11-03",
      },
    ],
  },
  SC: {
    reportName: "Annual report",
    frequency: "annual",
    due: "by the original due date of the corporate income tax return (or extension)",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "The License Fee is 0.1% of capital stock and paid-in surplus plus $15 (minimum $25), so it depends on capital.",
    },
    notes: [],
    unverified: [
      "SC LLC 'not required' is from SCDOR (LLCs not taxed as corporations are not subject to the annual report or license fee); no explicit SCSOS statement found.",
    ],
    sources: [
      {
        url: "https://dor.sc.gov/business-income-taxes/corporate/corporate-faqs",
        publisher: "dor.sc.gov",
        quote:
          "The License Fee rate is 0.1% of the corporation's capital stock and paid-in surplus plus $15.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dor.sc.gov/business-income-taxes/corporate/corporate-faqs",
        publisher: "dor.sc.gov",
        quote: "The minimum License Fee is $25.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dor.sc.gov/business-income-taxes/corporate/corporate-faqs",
        publisher: "dor.sc.gov",
        quote:
          "An LLC taxed as a corporation must complete the CL-1, Initial Annual Report of Corporations.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  TN: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Not verified on an official page (could not load the annual report instructions page)",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Fee depends on number of members: $300 minimum, plus $50 per member over 6, maximum $3,000.",
    },
    corporation: { required: true, feeCents: 2000, whyNotFixed: null },
    notes: [
      "Corporation: additional $20 if the registered agent/office is changed on the report. No online convenience fee seen.",
    ],
    unverified: [
      "Annual report due date rule (TN annual report instructions page redirected to tnbear.tn.gov and timed out).",
      "Late fee for annual reports: no official page loaded that states one.",
      "The per-member formula for LLC formation is not spelled out on the fees page (only '$300*' and 'Additional Fees May Apply'); the SS-4270 PDF could not be loaded.",
    ],
    sources: [
      {
        url: "https://sos.tn.gov/search?search_keywords=annual+report+fee",
        publisher: "sos.tn.gov",
        quote:
          "The annual report fee for a corporation is $20, and an additional $20 is required if any change is made concerning the registered agent/registered office. The annual report fee for LLCs is $300 minimum up to a maximum of $3000. The fee increases by an additional $50 per member for every member over 6 members up to a maximum of $3,000.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  TX: {
    reportName: "Annual report",
    frequency: "annual",
    due: "May 15 each year",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "No SOS annual report exists. The Comptroller filing carries no filing fee; franchise tax is computed on revenue/margin (no tax due at or below $2,650,000 for 2026-2027 report years).",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "No SOS annual report exists. The Comptroller filing carries no filing fee; franchise tax is computed on revenue/margin (no tax due at or below $2,650,000 for 2026-2027 report years).",
    },
    notes: [
      "Late: Comptroller: $50 penalty on each report filed after the due date.",
    ],
    unverified: [],
    sources: [
      {
        url: "https://comptroller.texas.gov/taxes/franchise/",
        publisher: "comptroller.texas.gov",
        quote: "The annual franchise tax report is due May 15.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://comptroller.texas.gov/taxes/franchise/",
        publisher: "comptroller.texas.gov",
        quote:
          "A $50 penalty is assessed on each report filed after the due date.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://comptroller.texas.gov/taxes/franchise/",
        publisher: "comptroller.texas.gov",
        quote:
          "simply file your 2026 Public Information Report or Ownership Report",
        checkedAt: "2026-11-03",
      },
    ],
  },
  UT: {
    reportName: "Annual renewal",
    frequency: "annual",
    due: "By the anniversary of registration (renewal period opens 60 days before)",
    llc: { required: true, feeCents: 1800, whyNotFixed: null },
    corporation: { required: true, feeCents: 1800, whyNotFixed: null },
    notes: [
      "Renewal fee includes a $5 surcharge (per schedule). No separate online convenience fee listed.",
      "Late: $10 late renewal fee; reinstatement is $18 per missed year plus $10 delinquency fee.",
    ],
    unverified: [
      "The fee schedule the Division links as current is titled 'Fiscal Year 2026 Fee Schedule Effective July 1, 2025'; no FY2027 (July 1, 2026) schedule was found, so amounts assume no change since July 2025. corporations.utah.gov/fees would not load.",
    ],
    sources: [
      {
        url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
        publisher: "commerce.utah.gov",
        quote: "*Domestic/foreign limited liability company (LLC) $18",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
        publisher: "commerce.utah.gov",
        quote: "*Domestic/foreign corporation $18",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
        publisher: "commerce.utah.gov",
        quote: "Late renewal fee $10",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://commerce.utah.gov/corporations/faqs/how-to-renew-a-business/",
        publisher: "commerce.utah.gov",
        quote:
          "The renewal is due one year from the date of registration and due annually thereafter unless you are filing a DBA",
        checkedAt: "2026-11-03",
      },
    ],
  },
  VA: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Last day of the month the LLC was organized, each year",
    llc: {
      required: false,
      feeCents: null,
      whyNotFixed: "No report is required for this entity type.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "Registration fee paid with the report is based on authorized shares. Per Va. Code 13.1-775.1: $50 for 5,000 shares or less, plus $15 per additional 5,000 shares or fraction, max $850 (SCC's own fee schedule PDF could not be loaded to cross-check).",
    },
    notes: [
      "SCC states there is no processing fee for online payments.",
      "Late: Corporation: penalty of 10% of the annual registration fee or $10, whichever is greater (Va. Code 13.1-775.1(C)).",
    ],
    unverified: [
      "SCC fee schedule PDFs (an_fee.pdf, cht_fee.pdf) could not be read (blocked to the fetch tool); corporation tiers taken from the statute only.",
      "Corporation formation filing fee (separate from the charter fee) amount not read.",
    ],
    sources: [
      {
        url: "https://www.scc.virginia.gov/businesses/business-faqs/annual-registration-fees/",
        publisher: "www.scc.virginia.gov",
        quote:
          "Limited Liability Companies | Your due date is the last day of the month your business was organized or registered. | $50.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.scc.virginia.gov/businesses/business-faqs/annual-registration-fees/",
        publisher: "www.scc.virginia.gov",
        quote: "Your fees are based on the number of authorized shares.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.scc.virginia.gov/businesses/business-faqs/annual-registration-fees/",
        publisher: "www.scc.virginia.gov",
        quote: "There is no processing fee for online payments.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-775.1/",
        publisher: "law.lis.virginia.gov",
        quote:
          "Any such corporation whose number of authorized shares is 5,000 or less shall pay an annual registration fee of $50.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-775/",
        publisher: "law.lis.virginia.gov",
        quote:
          "shall file, within the time prescribed by this section, an annual report.",
        checkedAt: "2026-11-03",
      },
    ],
  },
  VT: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Within 3 months after fiscal year end on record",
    llc: { required: true, feeCents: 4500, whyNotFixed: null },
    corporation: { required: true, feeCents: 6000, whyNotFixed: null },
    notes: [
      "All filings must be completed online; no convenience fee listed.",
      "Late: No late fee listed; reinstatement after failure to file is $50 (corporation) / $35 (LLC).",
    ],
    unverified: [],
    sources: [
      {
        url: "https://sos.vermont.gov/business-services/fees-statutes",
        publisher: "sos.vermont.gov",
        quote: "Annual Report | 11A V.S.A. § 16.22 | $60.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.vermont.gov/business-services/fees-statutes",
        publisher: "sos.vermont.gov",
        quote: "Annual Report | 11 V.S.A. § 4033 | $45.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.vermont.gov/business-services/business-filings/annualbiennial-reports",
        publisher: "sos.vermont.gov",
        quote: "within the first two and a half months (Profit Corps.)",
        checkedAt: "2026-11-03",
      },
    ],
  },
  WA: {
    reportName: "Annual report",
    frequency: "annual",
    due: "Last day of the month the entity was formed/registered",
    llc: { required: true, feeCents: 7000, whyNotFixed: null },
    corporation: { required: true, feeCents: 7000, whyNotFixed: null },
    notes: [
      "No online convenience fee listed. Optional expedite $100 (same-day $150).",
      "Late: $25 delinquency fee ($95 total with the report).",
    ],
    unverified: [],
    sources: [
      {
        url: "https://www.sos.wa.gov/sites/default/files/2025-12/6.2025%20-%20Annual%20Report%20-%20Profit%20Entity%20Types%2023B%20M&M%20&%20Corp%20Sole%20(Fillable%20Form).pdf",
        publisher: "www.sos.wa.gov",
        quote:
          "The filing fee is $70 for all business types except the Nonprofit Miscellaneous and Mutual Corporation",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.wa.gov/sites/default/files/2025-12/6.2025%20-%20Annual%20Report%20-%20Profit%20Entity%20Types%2023B%20M&M%20&%20Corp%20Sole%20(Fillable%20Form).pdf",
        publisher: "www.sos.wa.gov",
        quote:
          "Failure to file this annual report by your expiration date will result in a $25 delinquency fee and may result in administrative dissolution.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://www.sos.wa.gov/corporations-charities/frequently-asked-questions-faqs/fee-schedules-priority-services",
        publisher: "www.sos.wa.gov",
        quote: "Annual Report with delinquency fee $95",
        checkedAt: "2026-11-03",
      },
    ],
  },
  WI: {
    reportName: "Annual report",
    frequency: "annual",
    due: "By end of the calendar quarter containing the registration anniversary",
    llc: { required: true, feeCents: 2500, whyNotFixed: null },
    corporation: { required: true, feeCents: 2500, whyNotFixed: null },
    notes: [
      "Amount depends on filing method: $25 online (value used), $40 on paper. No separate convenience fee listed.",
      "Late: No late fee listed; delinquent entities risk administrative dissolution and must pay back annual report fees.",
    ],
    unverified: [
      "Wisconsin statute 180.0122 could not be read (blocked to the fetch tool); corporation formation fee taken from DFI fee page and form.",
    ],
    sources: [
      {
        url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
        publisher: "dfi.wi.gov",
        quote: "Annual Report via Online Filing $25.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
        publisher: "dfi.wi.gov",
        quote: "Annual Report $40.00",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/FAQ.aspx",
        publisher: "dfi.wi.gov",
        quote:
          "during the calendar year quarter in which the anniversary date of the registration occurs",
        checkedAt: "2026-11-03",
      },
    ],
  },
  WV: {
    reportName: "Biennial report",
    frequency: "biennial",
    due: "Between January 1 and June 30 each year after the registration year",
    llc: { required: true, feeCents: 2500, whyNotFixed: null },
    corporation: { required: true, feeCents: 2500, whyNotFixed: null },
    notes: [
      "No online processing fee listed.",
      "Late: $50 administrative late fee for for-profit entities ($100 for a biennial delinquency).",
    ],
    unverified: [],
    sources: [
      {
        url: "https://sos.wv.gov/business/updates-and-changes/annual-reports",
        publisher: "sos.wv.gov",
        quote: "pay the annual report $25.00 filing fee",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://code.wvlegislature.gov/59-1-2A/",
        publisher: "code.wvlegislature.gov",
        quote:
          "shall pay an annual report fee of $25 for the services of the Secretary of State as attorney-in-fact",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.wv.gov/sites/default/files/2026-07/Annualreportcorp_0.pdf",
        publisher: "sos.wv.gov",
        quote: "If paid by JUNE 30 deadline . . . $25.",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://code.wvlegislature.gov/59-1-2A/",
        publisher: "code.wvlegislature.gov",
        quote:
          "an administrative late fee in the amount of $50 for an annual delinquency and $100 for a biennial delinquency",
        checkedAt: "2026-11-03",
      },
    ],
  },
  WY: {
    reportName: "Annual report",
    frequency: "annual",
    due: "First day of the anniversary month of formation",
    llc: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "License tax is $60 or two-tenths of one mill ($.0002) on assets located and employed in Wyoming, whichever is greater.",
    },
    corporation: {
      required: true,
      feeCents: null,
      whyNotFixed:
        "License tax is $60 or two-tenths of one mill ($.0002) on assets located and employed in Wyoming, whichever is greater.",
    },
    notes: [
      "Online filing: a convenience fee is charged by the payment processor based on the total license tax due.",
      "Late: No late fee amount stated; entity goes delinquent and is administratively dissolved if not filed within 60 days of the due date.",
    ],
    unverified: [],
    sources: [
      {
        url: "https://sos.wyo.gov/Business/docs/BusinessFees.pdf",
        publisher: "sos.wyo.gov",
        quote:
          "*Annual Report License tax is $60 or two-tenths of one mill on the dollar ($.0002) whichever is greater based",
        checkedAt: "2026-11-03",
      },
      {
        url: "https://sos.wyo.gov/faqs.aspx?root=BUS",
        publisher: "sos.wyo.gov",
        quote:
          "a convenience fee is assessed by the payment processor based on the total license tax due",
        checkedAt: "2026-11-03",
      },
    ],
  },
};
