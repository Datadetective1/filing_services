import { PA_URLS } from "@/lib/compliance/states/pennsylvania";
import type { FaqItem } from "@/lib/compliance/types";

/**
 * High-intent Pennsylvania guide pages. Every factual statement comes from an official
 * Commonwealth source listed with the page (re-checked on PA_GUIDES_CHECKED). Rules:
 * no invented penalties or late fees, no urgency, no filing-status claims about anyone,
 * the state fee is always kept apart from Filewell's service fee, and no page links to or
 * points readers at the state's own filing site.
 *
 * Quotes are copied verbatim from the cited page.
 */

/** When the official sources behind these pages were last re-read. */
export const PA_GUIDES_CHECKED = "2026-10-01";

export interface GuideSource {
  title: string;
  publisher: string;
  url: string;
}

export interface GuideBlock {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  /** Ordered steps instead of bullets. */
  ordered?: boolean;
  quote?: { text: string; source: GuideSource };
}

export interface PaGuide {
  slug: string;
  /** <title> (the brand is appended by the layout template). */
  title: string;
  description: string;
  h1: string;
  /** Direct answer, shown first. */
  answer: string[];
  blocks: GuideBlock[];
  faq: FaqItem[];
  sources: GuideSource[];
  /** Embed the register search on the page itself (business search intent). */
  embedSearch?: boolean;
}

const DOS = "Pennsylvania Department of State";
const LEG = "Pennsylvania General Assembly";

export const SRC = {
  annualReports: { title: "Annual Reports", publisher: DOS, url: PA_URLS.dosAnnualReports },
  scamAlerts: { title: "Business and Charities Scam Alerts", publisher: DOS, url: PA_URLS.dosScamAlerts },
  fees: { title: "Fees and Payments", publisher: DOS, url: PA_URLS.dosFees },
  statute146: { title: "15 Pa.C.S. § 146. Annual report", publisher: LEG, url: PA_URLS.statute146 },
  statute153: { title: "15 Pa.C.S. § 153. Fee schedule", publisher: LEG, url: PA_URLS.statute153 },
  statute381: { title: "15 Pa.C.S. § 381. Grounds for administrative dissolution or cancellation", publisher: LEG, url: PA_URLS.statute381 },
  openData: {
    title: "Registered Businesses in PA - Current by County",
    publisher: "Commonwealth of Pennsylvania (data.pa.gov)",
    url: "https://data.pa.gov/Licenses-Certificates/Registered-Businesses-in-PA-Current-by-County-Depa/xvd7-5r2c",
  },
} satisfies Record<string, GuideSource>;

export const PA_GUIDES: PaGuide[] = [
  {
    slug: "annual-report-deadline",
    title: "Pennsylvania Annual Report Deadline 2027: June 30, Sept 30 or Dec 31",
    description:
      "PA annual reports are due June 30 for corporations, September 30 for LLCs and December 31 for other associations. From 2027, a business that doesn't file can be dissolved.",
    h1: "Pennsylvania annual report deadline",
    answer: [
      "Pennsylvania's annual report deadline depends on the type of entity. Corporations (business and nonprofit) file by June 30. Limited liability companies file by September 30. Every other association that files, such as limited partnerships, limited liability partnerships, business trusts and professional associations, files by December 31.",
      "The filing window opens January 1 each year. A new business files its first annual report in the year after it was formed or registered in Pennsylvania.",
    ],
    blocks: [
      {
        heading: "What the law says",
        paragraphs: [
          "The dates come from Pennsylvania's Associations Code. The statute words the first two deadlines as \"before\" a date, which is why the Department of State publishes them as June 30 and September 30.",
        ],
        quote: {
          text: "(1) before July 1 in the case of a domestic or foreign corporation for profit or not-for-profit; (2) before October 1 in the case of a domestic or foreign limited liability company; and (3) on or before December 31 in the case of any other form of domestic or foreign association.",
          source: SRC.statute146,
        },
      },
      {
        heading: "Your first annual report",
        paragraphs: [
          "Pennsylvania's annual report started in 2025. A business formed (or a foreign business registered) this year files its first report next year, in the window for its entity type.",
        ],
        quote: {
          text: "A company’s first annual report is due the year following its formation in Pennsylvania or its initial foreign registration.",
          source: SRC.annualReports,
        },
      },
      {
        heading: "Who doesn't file",
        paragraphs: [
          "Some registrations never file an annual report: fictitious names, general partnerships that are not limited liability partnerships, authorities, name reservations and registrations, land banks, financial institutions and credit unions, and trademarks.",
        ],
      },
      {
        heading: "If the deadline has passed",
        paragraphs: [
          "The Department of State says there is no state late fee for filing past the deadline, and the report can still be filed online. Our guide to filing after the deadline covers what the Department says about later years.",
        ],
      },
    ],
    faq: [
      {
        q: "Is the Pennsylvania annual report due on the same date every year?",
        a: "Yes. The date is fixed by entity type: June 30 for corporations, September 30 for LLCs, and December 31 for other associations. It doesn't depend on when the business was formed, except that the first report is due the year after formation.",
      },
      {
        q: "When does the filing window open?",
        a: "January 1 of each year, for every entity type.",
      },
      {
        q: "How do I know whether my business already filed this year?",
        a: "Ask whoever handles your filings. Filewell can't see filing status: the public register we use doesn't include it.",
      },
    ],
    sources: [SRC.annualReports, SRC.statute146, SRC.scamAlerts],
  },
  {
    slug: "annual-report-fee",
    title: "PA Annual Report Fee: $7 for LLCs and Businesses, $0 Nonprofits",
    description:
      "The Pennsylvania annual report fee is $7 when filed online, and $0 for nonprofit corporations and not-for-profit LPs and LLCs. No state late fee. How filing-service fees differ.",
    h1: "Pennsylvania annual report fee",
    answer: [
      "Filing a Pennsylvania annual report online costs $7. Nonprofit corporations, and limited partnerships or LLCs with a not-for-profit purpose, pay $0.",
      "The Department of State says there is no state late fee for filing past the deadline. If you use a private filing service, its fee is separate from, and on top of, the $7 state fee.",
    ],
    blocks: [
      {
        heading: "The state fee",
        quote: {
          text: "The fee for the new Annual Report is $7 for business corporations, limited liability companies (LLCs), limited partnerships (LPs) and limited liability general partnerships (LLPs), with a $0 fee for nonprofit corporations and any LPs or LLCs with a not-for-profit purpose.",
          source: SRC.annualReports,
        },
        paragraphs: ["The fee is paid by credit card when the report is filed online."],
      },
      {
        heading: "Late filing",
        quote: { text: "There is no state late fee for filing past the deadline", source: SRC.scamAlerts },
        paragraphs: [
          "Separately, the Department says that, beginning with annual reports due in 2027, an association that doesn't file can be administratively dissolved (or its registration terminated or cancelled) six months after the due date. Reinstating a dissolved business involves a reinstatement fee plus the fee for each annual report that wasn't paid.",
        ],
      },
      {
        heading: "Filing-service fees are extra",
        paragraphs: [
          "A filing service's fee is in addition to the $7 state fee, so compare the total. The Department of State has warned about third-party companies that charge large markups and send mail that looks official.",
          "Filewell is one of those private services, and we'd rather be upfront about it: we charge a $49.00 service fee plus the $7.00 state fee ($56.00 total for most businesses), shown as separate lines before you pay.",
        ],
      },
    ],
    faq: [
      {
        q: "Is the $7 fee the same for every entity type?",
        a: "Yes for business corporations, LLCs, LPs and LLPs. Nonprofit corporations, and LPs or LLCs with a not-for-profit purpose, pay $0.",
      },
      {
        q: "Does Pennsylvania charge a late fee for the annual report?",
        a: "No. The Department of State says there is no state late fee for filing past the deadline.",
      },
      {
        q: "Why do some companies charge $100 or more?",
        a: "Those are private service fees on top of the $7 state fee. Filewell charges a $49 service fee plus the $7 state fee, shown as separate lines before you pay.",
      },
    ],
    sources: [SRC.annualReports, SRC.scamAlerts, SRC.statute153],
  },
  {
    slug: "how-to-file-annual-report",
    title: "How to File a Pennsylvania Annual Report Online (Step by Step)",
    description:
      "How a Pennsylvania annual report is filed: what's involved, the information you need, the $7 fee, and what you get back. Based on Department of State guidance.",
    h1: "How to file a Pennsylvania annual report",
    answer: [
      "The annual report (form DSCB:15-146) is filed online with the Department of State. The business is looked up, the details are confirmed or updated, and the $7 fee is paid by credit card ($0 for nonprofits). Online filings are approved automatically, and the approved report is ready within minutes.",
      "Filewell can file it for you: we fill in what Pennsylvania's public register shows, you check and authorize it, and we send you the state's acknowledgement.",
    ],
    blocks: [
      {
        heading: "What filing involves",
        ordered: true,
        list: [
          "A Business Filing Services account with the Department of State.",
          "Finding the business and opening its annual report. No PIN is required.",
          "Completing the form online and paying by credit card.",
          "Downloading the approved report and acknowledgement letter.",
        ],
        quote: {
          text: "Annual Reports submitted online will be automatically approved. Online filers see statuses in real time and will be able to access the approved Annual Report within minutes.",
          source: SRC.annualReports,
        },
      },
      {
        heading: "Information you'll need",
        paragraphs: ["The law lists what the annual report contains. Have these ready:"],
        list: [
          "The business's name and where it was formed.",
          "Its registered office address (or commercial registered office provider).",
          "The name of at least one governor (for example a director, member or general partner).",
          "The names and titles of its principal officers, if it has any.",
          "Its principal office address.",
          "Its Pennsylvania entity number.",
        ],
      },
      {
        heading: "Have Filewell file it",
        paragraphs: [
          "Filewell is a private filing service. Search for your business and we fill in what Pennsylvania's public register shows, so you check details instead of typing them. You confirm everything and authorize the filing, we submit it, and we send you the state's acknowledgement. It costs our $49.00 service fee plus the $7.00 state fee.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I file the Pennsylvania annual report on paper?",
        a: "The Department of State says the annual report should be filed online, where filings are approved automatically.",
      },
      {
        q: "Do I need a PIN to file?",
        a: "No. The Department of State says no PIN access is required to file the annual report.",
      },
      {
        q: "How long does it take to be approved?",
        a: "Online filings are approved automatically, and the approved report is available within minutes, according to the Department of State.",
      },
    ],
    sources: [SRC.annualReports, SRC.statute146],
  },
  {
    slug: "annual-report-after-deadline",
    title: "Missed the PA Annual Report Deadline? No Late Fee, but 2027 Changes That",
    description:
      "A late Pennsylvania annual report is filed online for the same $7 ($0 for nonprofits), with no state late fee. From 2027, a business that doesn't file can be dissolved six months later.",
    h1: "Filing a Pennsylvania annual report after the deadline",
    answer: [
      "If a Pennsylvania annual report deadline has passed, the report can still be filed online in the usual way. The Department of State says there is no state late fee for filing past the deadline.",
      "The Department says administrative dissolution applies beginning with annual reports due in 2027, six months after the due date. Its published guidance doesn't describe dissolution for reports due in 2025 or 2026.",
    ],
    blocks: [
      {
        heading: "No state late fee",
        quote: { text: "There is no state late fee for filing past the deadline", source: SRC.scamAlerts },
        paragraphs: ["Filing late costs the same $7 state fee ($0 for nonprofits) as filing on time."],
      },
      {
        heading: "What changes with reports due in 2027",
        quote: {
          text: "Beginning with Annual Reports due in 2027, associations that fail to file annual reports in the 2027 calendar year will be subject to administrative dissolution/termination/cancellation six months after the due date of the Annual Report.",
          source: SRC.annualReports,
        },
        paragraphs: [
          "Depending on the entity, that means administrative dissolution (domestic filing entities), cancellation (domestic LLPs) or termination of registration (foreign associations), and loss of protection of the business's name. A dissolved business can apply for reinstatement, which the Department says involves a reinstatement fee plus the fee for each annual report that wasn't paid.",
        ],
      },
      {
        heading: "Check before you file",
        paragraphs: [
          "Someone at the business may already have filed. Ask whoever handles your filings before filing again. Filewell can't see whether a report was filed: the public register we use doesn't include filing status, so we only ever say a report may be due.",
        ],
      },
      {
        heading: "Watch out for official-looking mail",
        paragraphs: [
          "The Department of State has warned about companies that send solicitations about the annual report, sometimes with wrong information about fees or consequences. Anything not from the Department of State is from a private company, including Filewell.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I still file my 2026 Pennsylvania annual report after the deadline?",
        a: "Yes. Late reports are filed online the same way, and the Department of State says there is no state late fee.",
      },
      {
        q: "Will my business be dissolved for a late 2026 report?",
        a: "The Department of State's guidance ties administrative dissolution to annual reports due in 2027 and later, six months after the due date. For your specific situation, check with the Department of State or a lawyer.",
      },
      {
        q: "Does filing late cost more?",
        a: "Not in state fees. It's the same $7 ($0 for nonprofits).",
      },
    ],
    sources: [SRC.annualReports, SRC.scamAlerts, SRC.statute381],
  },
  {
    slug: "business-search",
    title: "PA Business Entity Search: Find a Company and Its Annual Report Due Date",
    description:
      "Look up a Pennsylvania business by name or entity number: entity type, formation date, county and when its annual report may be due. Free email reminder, no account needed.",
    h1: "Pennsylvania business search",
    answer: [
      "Search Pennsylvania's business register below by business name or entity number. We use the Department of State's register as published on data.pa.gov (updated monthly), and show the entity type, formation date, registered office county and when its annual report may be due.",
      "Filewell is a private service. The Department of State's own records are the authoritative source for any business.",
    ],
    embedSearch: true,
    blocks: [
      {
        heading: "What the register shows, and what it doesn't",
        paragraphs: [
          "The public register lists each registered business's name, entity number, type, formation date and address on record. It doesn't show standing, or whether this year's annual report was filed. That's why Filewell never says a business is active, compliant or behind: at most, a report may be due.",
        ],
      },
      {
        heading: "Ways to search",
        list: [
          "On this page: search by name or entity number and pick the business to see its filing requirement.",
          "data.pa.gov: the Commonwealth's open dataset of registered businesses, updated monthly.",
        ],
      },
      {
        heading: "After you find your business",
        paragraphs: [
          "You'll see when its annual report may be due and what it costs. Get free reminders before the next due date, or have Filewell file it for you.",
        ],
      },
    ],
    faq: [
      {
        q: "Is this the official Pennsylvania business search?",
        a: "No. Filewell is a private service, not the Department of State. We search the Department's register as published on data.pa.gov.",
      },
      {
        q: "Why can't I find a new business?",
        a: "The open dataset is updated monthly, so a business registered in the last few weeks may not appear yet. You can still enter its details by hand.",
      },
      {
        q: "Does the search show whether a business filed its annual report?",
        a: "No. The open register doesn't include filing history.",
      },
    ],
    sources: [SRC.openData, SRC.annualReports],
  },
];

export function getPaGuide(slug: string): PaGuide | undefined {
  return PA_GUIDES.find((g) => g.slug === slug);
}
