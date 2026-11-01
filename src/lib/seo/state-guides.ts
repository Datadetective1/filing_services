import { FL_URLS } from "@/lib/compliance/states/florida";
import { MT_URLS } from "@/lib/compliance/states/montana";
import { NV_URLS } from "@/lib/compliance/states/nevada";
import { UT_URLS } from "@/lib/compliance/states/utah";
import { WA_URLS } from "@/lib/compliance/states/washington";
import { PA_GUIDES, PA_GUIDES_CHECKED, type GuideSource, type PaGuide } from "./pa-guides";

/**
 * Supporting guide pages per state (the state hub is /annual-report/<state>). Only the most
 * useful topics; every fact is quoted from an official source listed with the page and was
 * re-read on the state's `checked` date. Same rules as the Pennsylvania guides: no invented
 * penalties, no urgency, no status claims, state fees kept apart from Filewell's fee, and
 * the direct state filing option on every page.
 */

export type StateGuide = PaGuide;

export interface StateGuideSet {
  stateCode: string;
  stateName: string;
  slug: string;
  checked: string;
  guides: StateGuide[];
}

const WA_SOS = "Washington Secretary of State";
const WA_LEG = "Washington State Legislature";
const NV_LEG = "Nevada Legislature (Nevada Revised Statutes)";
const UT_DIV = "Utah Division of Corporations and Commercial Code";
const UT_LEG = "Utah Legislature (Utah Code)";

const WA = {
  forms: { title: "Filings, forms and information", publisher: WA_SOS, url: WA_URLS.forms },
  faq: { title: "Annual reports FAQ", publisher: WA_SOS, url: WA_URLS.faq },
  ccfsFaq: { title: "CCFS tools and resources", publisher: WA_SOS, url: WA_URLS.ccfsFaq },
  wac060: { title: "WAC 434-112-060 Annual reports", publisher: WA_LEG, url: WA_URLS.wac060 },
  wac085: { title: "WAC 434-112-085 Fees", publisher: WA_LEG, url: WA_URLS.wac085 },
  rcw605: { title: "RCW 23.95.605 Administrative dissolution", publisher: WA_LEG, url: WA_URLS.rcw605 },
  instructions: { title: "File an annual report online", publisher: WA_SOS, url: WA_URLS.onlineInstructions },
} satisfies Record<string, GuideSource>;

const NV = {
  nrs76: { title: "NRS Chapter 76 State business license", publisher: NV_LEG, url: NV_URLS.nrs76 },
  nrs78: { title: "NRS Chapter 78 Private corporations", publisher: NV_LEG, url: NV_URLS.nrs78 },
  nrs86: { title: "NRS Chapter 86 Limited-liability companies", publisher: NV_LEG, url: NV_URLS.nrs86 },
} satisfies Record<string, GuideSource>;

const UT = {
  statute: { title: "Utah Code 16-1a-212 Annual report (effective October 1, 2026)", publisher: UT_LEG, url: UT_URLS.statute212 },
  fees: { title: "Fee Schedule (FY2026)", publisher: UT_DIV, url: UT_URLS.feeSchedule },
  coupon: { title: "Annual Report/Renewal coupon", publisher: UT_DIV, url: UT_URLS.coupon },
  renewal: { title: "Renewal process", publisher: UT_DIV, url: UT_URLS.renewalProcess },
} satisfies Record<string, GuideSource>;


const FL_DIV = "Florida Department of State, Division of Corporations";
const FL_LEG = "Florida Legislature (Florida Statutes)";
const MT_SOS = "Montana Secretary of State";
const MT_LEG = "Montana Legislature (MCA)";

const FL = {
  annualReport: { title: "Annual Report", publisher: FL_DIV, url: FL_URLS.annualReport },
  instructions: { title: "Annual Report instructions", publisher: FL_DIV, url: FL_URLS.instructions },
  statute605: { title: "Florida Statutes 605.0212 Annual report", publisher: FL_LEG, url: FL_URLS.statute605_0212 },
  search: { title: "Search records by name", publisher: FL_DIV, url: FL_URLS.search },
} satisfies Record<string, GuideSource>;

const MT = {
  help: { title: "How do I file my annual report?", publisher: MT_SOS, url: MT_URLS.help },
  waiver: { title: "Secretary Jacobsen continues Montana business support by waiving fees once again", publisher: MT_SOS, url: MT_URLS.waiver },
  fees: { title: "Fees", publisher: MT_SOS, url: MT_URLS.fees },
  llcStatute: { title: "MCA 35-8-208 Annual report", publisher: MT_LEG, url: MT_URLS.llcStatute },
  llcDissolution: { title: "MCA 35-8-209 Administrative dissolution", publisher: MT_LEG, url: MT_URLS.llcDissolution },
  corpDissolution: { title: "MCA 35-14-1420 Grounds for administrative dissolution", publisher: MT_LEG, url: MT_URLS.corpDissolution },
} satisfies Record<string, GuideSource>;

const FL_SEPTEMBER_QUOTE =
  "If you do not file an annual report by the third Friday of September, your business entity will be administratively dissolved or revoked";

const FLORIDA: StateGuide[] = [
  {
    slug: "annual-report-deadline",
    title: "Florida Annual Report Deadline: May 1 (Opens January 1)",
    description:
      "Florida LLCs and corporations file their annual report on Sunbiz between January 1 and May 1. After May 1, Florida adds a $400 late fee. From official sources.",
    h1: "Florida annual report deadline",
    answer: [
      "Every Florida LLC and profit corporation, and every foreign one registered in Florida, files an annual report between January 1 and May 1 each year. The first one is due the year after the business was formed or registered.",
      "A report filed after May 1 costs an extra $400, which Florida says it can't waive. If it still isn't filed by the third Friday of September, Florida dissolves the business or revokes its authority.",
    ],
    blocks: [
      {
        heading: "What the law says",
        quote: {
          text: "Subsequent annual reports must be delivered to the department between January 1 and May 1 of each calendar year thereafter.",
          source: FL.statute605,
        },
      },
      {
        heading: "The exact cut-off",
        quote: { text: "will have until 11:59 PM EST on Friday May 1, 2026, before a $400 late fee is assessed.", source: FL.annualReport },
        paragraphs: ["That's the cut-off Sunbiz gave for 2026. Check Sunbiz for the next year's exact time."],
      },
      {
        heading: "Two dates to remember",
        list: [
          "May 1: last day to file without the $400 late fee.",
          "Third Friday of September: last day before Florida dissolves or revokes the business.",
        ],
        quote: { text: FL_SEPTEMBER_QUOTE, source: FL.annualReport },
      },
    ],
    faq: [
      { q: "When can I file?", a: "From January 1. Florida's window runs January 1 to May 1 every year." },
      { q: "Do I file in the year my business was formed?", a: "No. The first report is due between January 1 and May 1 of the year after the business was formed or registered in Florida." },
      { q: "Do nonprofits pay the late fee?", a: "No. Florida says not for profit corporations aren't subject to the $400 late fee." },
    ],
    sources: [FL.annualReport, FL.statute605, FL.instructions],
  },
  {
    slug: "annual-report-late-fee",
    title: "Florida Annual Report Late Fee: $400 After May 1",
    description:
      "Florida adds a $400 late fee to an LLC or corporation annual report filed after May 1, and says it can't be waived. Nonprofits are exempt. From official sources.",
    h1: "Florida annual report late fee",
    answer: [
      "Florida adds a $400 late fee to an LLC or profit corporation annual report filed after May 1. The Division of Corporations says there's no way to waive it.",
      "Not for profit corporations are exempt. Filing by May 1 is the only way to avoid it.",
    ],
    blocks: [
      {
        heading: "What Florida says",
        quote: { text: "There is no provision to abate or waive the $400 late fee.", source: FL.instructions },
      },
      {
        heading: "What a late report costs the state",
        list: ["LLC: $138.75 report fee + $400 late fee = $538.75", "Profit corporation: $150 report fee + $400 late fee = $550"],
        paragraphs: ["A filing service's fee, if you use one, is on top of these state fees."],
      },
      {
        heading: "After the third Friday of September",
        quote: { text: FL_SEPTEMBER_QUOTE, source: FL.annualReport },
      },
    ],
    faq: [
      { q: "Can the $400 late fee be waived?", a: "Florida's instructions say there's no provision to abate or waive it." },
      { q: "Can I still file after May 1?", a: "Yes. File on Sunbiz as usual and pay the report fee plus the $400 late fee." },
      { q: "Do nonprofits pay it?", a: "No. Florida says not for profit corporations aren't subject to the $400 late fee." },
    ],
    sources: [FL.instructions, FL.annualReport],
  },
  {
    slug: "annual-report-fee",
    title: "Florida Annual Report Fee: $138.75 LLC, $150 Corporation",
    description:
      "Florida's annual report fee is $138.75 for an LLC and $150 for a profit corporation, paid on Sunbiz. After May 1, a $400 late fee is added. From official sources.",
    h1: "Florida annual report fee",
    answer: [
      "Filing a Florida annual report costs $138.75 for an LLC and $150 for a profit corporation, paid by card on Sunbiz.",
      "After May 1, Florida adds a $400 late fee. A filing service's fee is separate from, and on top of, the state fee.",
    ],
    blocks: [
      {
        heading: "LLC",
        quote: { text: "Annual Report - Limited Liability Company $138.75", source: FL.annualReport },
      },
      {
        heading: "Profit corporation",
        quote: { text: "Annual Report - Profit Corporation $150.00", source: FL.annualReport },
      },
      {
        heading: "Filing-service fees are extra",
        paragraphs: [
          "You never have to use a filing service. You can file directly on Sunbiz for the state fee. If you use a service, compare the total: its fee is in addition to Florida's.",
        ],
      },
    ],
    faq: [
      { q: "Is there a late fee?", a: "Yes. Florida adds $400 to a report filed after May 1 and says it can't waive it." },
      { q: "When can I pay?", a: "Any time from January 1. The fee is the same until May 1." },
    ],
    sources: [FL.annualReport, FL.instructions],
  },
  {
    slug: "how-to-file-annual-report",
    title: "How to File a Florida Annual Report on Sunbiz",
    description:
      "How to file a Florida annual report on Sunbiz: your document number, what to check, who signs, the fee and what you get back. From official sources.",
    h1: "How to file a Florida annual report",
    answer: [
      "You file online on Sunbiz using your business's document number. You check the information on record, list at least one principal, have one of the business's own principals sign by typing their name, and pay by card.",
      "Sunbiz says online reports are processed and posted immediately.",
    ],
    blocks: [
      {
        heading: "Your document number",
        quote: { text: "You must use the 6 or 12 digit document number assigned to your corporation", source: FL.instructions },
        paragraphs: ["It's on your Sunbiz record and on letters from the Division of Corporations."],
      },
      {
        heading: "Information you'll check",
        list: [
          "Federal employer identification number, or whether one was applied for.",
          "Principal office and mailing address.",
          "Registered agent and its Florida street address.",
          "At least one principal (manager, member or officer), with title and address.",
        ],
      },
      {
        heading: "Who signs",
        quote: { text: "Typing someone´s name/signature without their permission constitutes forgery.", source: FL.instructions },
        paragraphs: ["One of the business's own principals types their name to sign. Florida treats the typed name as a signature."],
      },
      {
        heading: "Changing your registered agent",
        quote: { text: "the new registered agent must accept the designation by \"electronically signing\" the annual report.", source: FL.instructions },
      },
    ],
    faq: [
      { q: "Do I need a Sunbiz account?", a: "No account is needed to file an annual report. You need the business's document number." },
      { q: "How fast is it?", a: "Sunbiz says reports filed online are processed and posted immediately." },
      { q: "Can a filing service sign for me?", a: "Not in your name without your permission. With Filewell, you sign the report yourself and we enter your signature exactly as you typed it." },
    ],
    sources: [FL.instructions, FL.annualReport, FL.search],
  },
];

const MONTANA: StateGuide[] = [
  {
    slug: "annual-report-deadline",
    title: "Montana Annual Report Deadline: April 15 (Fee Waived)",
    description:
      "Montana LLCs and corporations file their annual report between January 1 and April 15. Filed on time, the fee is waived in 2026 and 2027; after April 15 it's $35.",
    h1: "Montana annual report deadline",
    answer: [
      "Montana LLCs and corporations file their annual report between January 1 and April 15 each year, starting the year after they were formed.",
      "The Secretary of State waives the fee for reports filed by April 15, and has said the waiver continues in 2027. After April 15 the fee is $35.",
    ],
    blocks: [
      {
        heading: "What the law says",
        quote: { text: "Subsequent annual reports must be delivered to the secretary of state between January 1 and April 15.", source: MT.llcStatute },
      },
      {
        heading: "Free if you file on time",
        quote: {
          text: "The Secretary of State's Office will waive the fee for all annual reports filed between January 1st and April 15th.",
          source: MT.help,
        },
        paragraphs: ["Montana announced the waiver continues in 2027."],
      },
      {
        heading: "After April 15",
        quote: { text: "After April 15th, the fee is $35.", source: MT.help },
        paragraphs: [
          "An LLC that still hasn't filed after 140 days can be administratively dissolved. For a corporation, it's 120 days after the report was due.",
        ],
      },
    ],
    faq: [
      { q: "When can I file?", a: "From January 1. The window runs January 1 to April 15." },
      { q: "Is it really free?", a: "Yes for reports filed by April 15 in 2026 and 2027, according to the Secretary of State. After April 15 it's $35." },
    ],
    sources: [MT.llcStatute, MT.help, MT.waiver, MT.llcDissolution, MT.corpDissolution],
  },
  {
    slug: "how-to-file-annual-report",
    title: "How to File a Montana Annual Report Online",
    description:
      "How to file a Montana annual report at biz.sosmt.gov: search your business, review, check the declarations and file. No login needed if nothing changed.",
    h1: "How to file a Montana annual report",
    answer: [
      "You file on Montana's business services site, biz.sosmt.gov. If nothing has changed, you don't need to log in: find your business, review the report, check each declaration and file. To change information, log in first.",
    ],
    blocks: [
      {
        heading: "Steps (no changes)",
        ordered: true,
        list: [
          "Go to biz.sosmt.gov and search for your business.",
          "Open your business from the results.",
          "Click File Annual Report on the right.",
          "Review the information on the report.",
          "Read and check each declaration box, and fill in the required fields.",
          "Click File Online.",
        ],
      },
      {
        heading: "If something changed",
        paragraphs: ["Log in to biz.sosmt.gov first, then follow the same steps and update the report as you go."],
      },
      {
        heading: "Signing",
        quote: { text: "To sign, read, and check each declaration box, and fill in all fields marked with a red asterisk.", source: MT.help },
      },
    ],
    faq: [
      { q: "What does it cost?", a: "Nothing if filed by April 15 in 2026 and 2027. After April 15 it's $35." },
      { q: "Who can sign an LLC's report?", a: "Montana law says at least one member of the LLC or its authorized agent." },
    ],
    sources: [MT.help, MT.llcStatute],
  },
];

const WASHINGTON: StateGuide[] = [
  {
    slug: "annual-report-deadline",
    title: "Washington Annual Report Deadline: Your Expiration Date",
    description:
      "A Washington annual report is due by the business's expiration date: the last day of the month it was formed or registered. You can file up to 180 days early. From official sources.",
    h1: "Washington annual report deadline",
    answer: [
      "A Washington business's annual report is due by its expiration date: the last day of the month in which it was first formed or registered with the Secretary of State. That applies to domestic and foreign entities.",
      "You can file up to 180 days before the due date, and filing early doesn't change the expiration date.",
    ],
    blocks: [
      {
        heading: "What the rule says",
        quote: {
          text: "must file an annual report accompanied by the fee established under WAC 434-112-085 by the last day of the month that the entity was formed or registered by the division.",
          source: WA.wac060,
        },
        paragraphs: ["Online filings count as on time when they're submitted before midnight on the due date."],
      },
      {
        heading: "Filing early",
        quote: { text: "An annual report may be filed up to 180 days prior to the due date.", source: WA.wac060 },
      },
      {
        heading: "If the expiration date has passed",
        paragraphs: [
          "Washington says that not filing by the expiration date results in a delinquent status. When a business's status is listed as Delinquent, the state adds a $25 delinquency fee to the $70 report fee. If the report still isn't filed 120 days after it's due, the state may begin administrative dissolution.",
        ],
        quote: {
          text: "Failure to file on or before the expiration date results in a delinquent status and may lead to administrative dissolution.",
          source: WA.faq,
        },
      },
    ],
    faq: [
      { q: "How do I find my expiration date?", a: "It's shown on the business's record in Washington's Corporations and Charities Filing System (CCFS) search, and it's the last day of the month the business was formed or registered." },
      { q: "Does filing early move my expiration date?", a: "No. Washington says filing early doesn't change the expiration date." },
      { q: "Does Filewell know whether my business is delinquent?", a: "Only when we've seen Washington's own record for it. We never assume a status from dates alone." },
    ],
    sources: [WA.forms, WA.wac060, WA.faq],
  },
  {
    slug: "annual-report-fee",
    title: "Washington Annual Report Fee: $70 (and When the $25 Delinquency Fee Applies)",
    description:
      "Washington's annual report fee is $70 for profit corporations, LLCs, LPs and LLPs. A $25 delinquency fee applies only when the state lists the business as Delinquent. From official sources.",
    h1: "Washington annual report fee",
    answer: [
      "Filing a Washington annual report costs $70 for domestic and foreign profit corporations, LLCs, limited partnerships and LLPs. Washington doesn't add an online processing fee to annual reports.",
      "If the business's status is listed as Delinquent, Washington adds a $25 delinquency fee, for $95 in total. A filing service's fee is separate from, and on top of, the state fee.",
    ],
    blocks: [
      {
        heading: "The state fee",
        quote: { text: "Profit Business Entity Types, including LLC $70", source: WA.forms },
        paragraphs: ["Nonprofit corporations pay different fees and aren't covered on this page."],
      },
      {
        heading: "The delinquency fee",
        quote: { text: "If the business entity's status is listed as Delinquent an additional $25 delinquency fee will be assessed.", source: WA.forms },
        paragraphs: [
          "The fee depends on the state's record, not on a date someone calculates. Check your business's status in Washington's CCFS search before filing.",
        ],
      },
      {
        heading: "Filing-service fees are extra",
        paragraphs: [
          "You never have to use a filing service. You can file directly with the Washington Secretary of State online. If you use a service, compare the total: its fee is in addition to the state's.",
        ],
      },
    ],
    faq: [
      { q: "Is the fee different for a foreign LLC?", a: "No. Washington's fee rule covers domestic and foreign business entities at the same $70." },
      { q: "Is there an online processing fee?", a: "Not for annual reports. Washington's $20 online processing fee excludes them." },
      { q: "When does the $25 apply?", a: "When the business's status is listed as Delinquent, which happens if the report isn't filed by the expiration date." },
    ],
    sources: [WA.forms, WA.wac085],
  },
  {
    slug: "how-to-file-annual-report",
    title: "How to File a Washington Annual Report (Express or Regular)",
    description:
      "How to file a Washington annual report in CCFS: the Express Annual Report option, the regular report, what information you need and what it costs. From official sources.",
    h1: "How to file a Washington annual report",
    answer: [
      "You file online in Washington's Corporations and Charities Filing System (CCFS). If a previous annual report is already on record, you can use the Express Annual Report option; otherwise you file the regular annual report from a CCFS account. The fee is $70 for profit businesses, paid by card.",
    ],
    blocks: [
      {
        heading: "Express Annual Report",
        quote: {
          text: "Customers who only need to file an annual report can take advantage of our Express Annual Report Option. To be eligible, a previous Annual Report must already be filed on record.",
          source: WA.ccfsFaq,
        },
      },
      {
        heading: "Information you'll need",
        list: [
          "The business's name, UBI number and where it was formed.",
          "The registered agent's name and Washington street address.",
          "The principal office address and an email address.",
          "The names of the governors (directors, managers, members or general partners).",
          "A brief description of the nature of the business.",
          "Answers to the Department of Revenue's controlling-interest questions.",
        ],
      },
      {
        heading: "What you get back",
        paragraphs: [
          "Online filing gives immediate submission confirmation. Without an upload, the information shows on the record right away and the expiration date moves to next year.",
        ],
      },
    ],
    faq: [
      { q: "Do I need an account to file?", a: "Washington says nonprofit corporations must log in. For other businesses, the Express Annual Report option is available when a previous annual report is on record." },
      { q: "Can someone else file it for me?", a: "Yes. Washington's rules let an authorized agent file, and the person filing affirms they're authorized." },
    ],
    sources: [WA.ccfsFaq, WA.instructions, WA.forms],
  },
];

const NEVADA: StateGuide[] = [
  {
    slug: "annual-list-fee",
    title: "Nevada Annual List and State Business License Fees (LLC $350, Corporation $650)",
    description:
      "Nevada's annual list fee plus the State Business License fee: $150 + $200 for LLCs and partnerships, $150 + $500 for corporations at the lowest tier. Late penalties: $75 and $100. From the NRS.",
    h1: "Nevada annual list and business license fees",
    answer: [
      "Each year a Nevada business pays two state fees together: the annual list fee and the State Business License renewal fee. For LLCs, limited partnerships and LLPs that's $150 + $200 = $350. For corporations whose authorized stock is worth $75,000 or less, it's $150 + $500 = $650.",
      "Filed after the due date, Nevada adds a $75 annual list penalty and a $100 business license penalty. A filing service's fee is separate from these state fees.",
    ],
    blocks: [
      {
        heading: "State Business License fee",
        quote: {
          text: "a fee in the amount of $200, except that if the applicant is a corporation organized pursuant to chapter 78, 78A or 78B of NRS, or a foreign corporation required to file an initial or annual list ... pursuant to chapter 80 of NRS, the application must be accompanied by a fee of $500",
          source: NV.nrs76,
        },
        paragraphs: ["Title 7 entities renew the license at the time they file the annual list."],
      },
      {
        heading: "Annual list fee",
        paragraphs: [
          "The annual list fee is $150 for LLCs, limited partnerships and LLPs. A corporation's annual list fee depends on the value of its authorized shares: $150 at $75,000 or less, rising in tiers above that.",
        ],
      },
      {
        heading: "Late penalties",
        quote: { text: "For default there must be added to the amount of the fee a penalty of $75.", source: NV.nrs86 },
        paragraphs: ["The business license law separately adds a $100 penalty for late renewal by a Title 7 entity."],
      },
    ],
    faq: [
      { q: "Why are there two fees?", a: "The annual list and the State Business License are separate Nevada requirements, paid together when the list is filed." },
      { q: "Are nonprofits charged the business license fee?", a: "Nevada nonprofit corporations (NRS 82) are exempt from the business license and pay a $50 list fee. Filewell doesn't cover nonprofits yet." },
      { q: "Can I file it myself?", a: "Yes, directly with the Nevada Secretary of State online." },
    ],
    sources: [NV.nrs76, NV.nrs86, NV.nrs78],
  },
  {
    slug: "annual-list-deadline",
    title: "Nevada Annual List Deadline: Last Day of Your Anniversary Month",
    description:
      "A Nevada annual list is due by the last day of the month in which the business was formed (or qualified in Nevada). What happens after the deadline, from the NRS.",
    h1: "Nevada annual list deadline",
    answer: [
      "A Nevada business files its annual list, and renews its State Business License, by the last day of the month in which it was formed. A foreign business uses the anniversary of its qualification to do business in Nevada.",
    ],
    blocks: [
      {
        heading: "What the law says",
        quote: { text: "on or before the last day of the month in which the anniversary date of its organization occurs", source: NV.nrs86 },
      },
      {
        heading: "Filing early",
        quote: { text: "more than 90 days before its due date shall be deemed an amended list for the previous year", source: NV.nrs86 },
        paragraphs: ["In practice, file within the 90 days before the due date."],
      },
      {
        heading: "After the deadline",
        paragraphs: [
          "A business that misses the due date is in default, and Nevada adds a $75 annual list penalty and a $100 business license penalty. A domestic entity's charter is revoked about a year later if it still hasn't filed; reinstatement costs extra.",
        ],
        quote: {
          text: "On the first day of the first anniversary of the month following the month in which the filing was required, the charter of the corporation is revoked",
          source: NV.nrs78,
        },
      },
    ],
    faq: [
      { q: "Does Nevada send a reminder?", a: "Nevada sends a notice, but the law says not receiving one doesn't excuse the penalty." },
      { q: "How do I find my anniversary month?", a: "It's the month your business was formed or qualified in Nevada, shown on the Secretary of State's business record." },
    ],
    sources: [NV.nrs86, NV.nrs78],
  },
];

const UTAH: StateGuide[] = [
  {
    slug: "annual-renewal-fee",
    title: "Utah Annual Renewal Fee: $18 (and the $10 Late Renewal Fee)",
    description:
      "Utah's annual report/renewal fee is $18 for LLCs, corporations, LPs and LLPs. The $10 late renewal fee applies to overdue renewals for those types. From official sources.",
    h1: "Utah annual renewal fee",
    answer: [
      "Utah's annual report/renewal costs $18 for domestic and foreign LLCs, corporations, limited partnerships and LLPs. Utah's fee schedule lists a $10 late renewal fee for overdue renewals of those types; its renewal coupon lists no late fee for business trusts.",
      "A filing service's fee is separate from, and on top of, the state fee. You can renew directly with Utah online.",
    ],
    blocks: [
      {
        heading: "The state fee",
        quote: { text: "*Domestic/foreign LLC ... $18", source: UT.fees },
        paragraphs: ["Utah notes that these fees include a $5 surcharge for the state's single sign-on portal, and that processing fees are nonrefundable."],
      },
      {
        heading: "The late renewal fee",
        quote: { text: "Late renewal fee $10", source: UT.fees },
        paragraphs: [
          "Utah applies it to overdue renewals. Filewell only tells you it applies when Utah's own record shows the renewal as delinquent.",
        ],
      },
      {
        heading: "If a business is dissolved",
        quote: {
          text: "Reinstatement filings incur a $18 charge for each year the renewal/annual report filing was missed, in addition to a $10 delinquency fee.",
          source: UT.fees,
        },
      },
    ],
    faq: [
      { q: "Do I need a UtahID to renew?", a: "Yes. Utah's online renewal requires a UtahID login." },
      { q: "Can I change my registered agent during renewal?", a: "Yes. Utah's renewal lets you update the principal office, registered agent and principals." },
    ],
    sources: [UT.fees, UT.coupon, UT.renewal],
  },
  {
    slug: "annual-report-deadline",
    title: "Utah Annual Report Deadline (New Rule From October 1, 2026)",
    description:
      "From October 1, 2026, Utah annual reports are due on the last day of the business's anniversary month and may be filed up to 60 days early (Utah Code 16-1a-212).",
    h1: "Utah annual report deadline",
    answer: [
      "Under Utah Code 16-1a-212, effective October 1, 2026, a Utah business delivers its annual report each year on the last day of its anniversary month: the month its formation became effective, or a foreign entity's registration took effect. It may file up to 60 days before.",
    ],
    blocks: [
      {
        heading: "What the law says",
        quote: {
          text: "shall deliver an annual report to the division each calendar year on the last day of the anniversary month; and (ii) may deliver the annual report up to 60 days before the last day of the anniversary month",
          source: UT.statute,
        },
        paragraphs: [
          "The statute lets the Division set a different time period by rule. Utah's older materials describe the renewal as due on the anniversary date; check your renewal notice for the date Utah shows.",
        ],
      },
      {
        heading: "After the deadline",
        paragraphs: [
          "If the report isn't filed within 60 days after it's due, the Division may begin administrative dissolution, and the business then has 60 days after notice to cure it.",
        ],
      },
    ],
    faq: [
      { q: "What is my anniversary month?", a: "The month your business's formation became effective in Utah, or a foreign business's registration took effect." },
      { q: "Can I file early?", a: "Yes, up to 60 days before the last day of the anniversary month." },
    ],
    sources: [UT.statute, UT.renewal],
  },
];

export const STATE_GUIDE_SETS: StateGuideSet[] = [
  { stateCode: "PA", stateName: "Pennsylvania", slug: "pennsylvania", checked: PA_GUIDES_CHECKED, guides: PA_GUIDES },
  { stateCode: "WA", stateName: "Washington", slug: "washington", checked: "2026-10-01", guides: WASHINGTON },
  { stateCode: "NV", stateName: "Nevada", slug: "nevada", checked: "2026-10-01", guides: NEVADA },
  { stateCode: "UT", stateName: "Utah", slug: "utah", checked: "2026-10-01", guides: UTAH },
  { stateCode: "FL", stateName: "Florida", slug: "florida", checked: "2026-11-01", guides: FLORIDA },
  { stateCode: "MT", stateName: "Montana", slug: "montana", checked: "2026-11-01", guides: MONTANA },
];

export function guideSet(stateCode: string): StateGuideSet | undefined {
  return STATE_GUIDE_SETS.find((s) => s.stateCode === stateCode);
}
