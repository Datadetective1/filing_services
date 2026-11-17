/**
 * Answer-first copy for state annual report pages that have no full guide yet (no verified
 * compliance rules). Each answer is written from sentences read on the state's own official
 * pages on `checked`; the quotes are kept here as the record. Pages show the answer and the
 * facts, never a link to the state's own filing site.
 *
 * A fact we couldn't read on an official page is left out, not guessed. An answer here makes
 * the page indexable, so only add one when its due date or fee is backed by a quote below.
 */

export interface StateAnswer {
  /** <title>, starting with "[State] Annual Report". */
  title: string;
  /** Search snippet, at most about 160 characters. */
  description: string;
  /** The first sentences on the page: due date and what the state charges. */
  answer: string;
  /** Under the "[State] LLC annual report" subhead. */
  llc: string;
  /** Extra plain facts shown as a short list under the LLC answer. */
  more: string[];
  /** The status panel: term and value, short. */
  facts: { term: string; value: string }[];
  /** ISO date the official pages were read. */
  checked: string;
  /** Where each fact was read, with the sentence quoted. Not linked from sales pages. */
  sources: { url: string; quote: string }[];
}

export const STATE_ANSWERS: Record<string, StateAnswer> = {
  DE: {
    title: "Delaware Annual Report: $400 LLC Tax by June 1, Corporations by March 1",
    description:
      "Delaware LLCs file no annual report: they pay a $400 annual tax by June 1. Corporations file a $50 report with franchise tax by March 1.",
    answer:
      "Delaware LLCs don't file an annual report. They pay a flat annual tax by June 1, which the state now lists as $400. Corporations file an annual report ($50) and pay franchise tax by March 1.",
    llc: "A Delaware LLC pays the annual tax for the year before by June 1. Delaware raised it from $300 to $400 in 2026. Paying late adds a $200 penalty plus 1.5% interest a month.",
    more: ["Corporations: the minimum franchise tax is $175 under the Authorized Shares Method, or $400 under the Assumed Par Value Capital Method."],
    facts: [
      { term: "LLCs", value: "$400 annual tax, due June 1" },
      { term: "Corporations", value: "$50 report plus franchise tax, due March 1" },
      { term: "Late", value: "$200 penalty plus 1.5% a month" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://corp.delaware.gov/alt-entitytaxinstructions/", quote: "There is no requirement to file an Annual Report." },
      { url: "https://corp.delaware.gov/alt-entitytaxinstructions/", quote: "are required to pay an annual tax of $400.00." },
      { url: "https://corp.delaware.gov/alt-entitytaxinstructions/", quote: "The annual taxes for the prior year are due on or before June 1st." },
      { url: "https://corp.delaware.gov/alt-entitytaxinstructions/", quote: "Failure to pay the required annual taxes will result in a penalty of $200.00 plus 1.5% interest per month on tax and penalty." },
      { url: "https://delcode.delaware.gov/title6/c018/sc11/index.html", quote: "in the amount of $400." },
      { url: "https://corp.delaware.gov/paytaxes/", quote: "Non-Exempt Domestic Corporations – $50.00." },
      { url: "https://corp.delaware.gov/paytaxes/", quote: "All active Domestic Corporation Annual Reports and Franchise Taxes for the prior year are due annually on or before March 1st" },
      { url: "https://corp.delaware.gov/paytaxes/", quote: "The minimum tax is currently $175.00, using the Authorized Shares Method" },
    ],
  },
  MD: {
    title: "Maryland Annual Report: $300 Fee, Due April 15",
    description:
      "Maryland annual reports (Form 1) are due April 15 each year. The state fee is $300 for LLCs and stock corporations.",
    answer: "Maryland annual reports, filed on Form 1, are due April 15 each year. The state fee is $300 for LLCs and for stock corporations.",
    llc: "A Maryland LLC files the same Form 1 by April 15 and pays $300.",
    more: [],
    facts: [
      { term: "Due", value: "April 15 each year" },
      { term: "State fee", value: "$300 for LLCs and stock corporations" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://dat.maryland.gov/SDAT%20Forms/PPR_Forms/2026_Form1.pdf", quote: "Due April 15th" },
      { url: "https://dat.maryland.gov/SDAT%20Forms/PPR_Forms/2026_Form1.pdf", quote: "Domestic or Foreign Limited Liability Company (W) or (Z) $300" },
      { url: "https://dat.maryland.gov/SDAT%20Forms/PPR_Forms/2026_Form1.pdf", quote: "Domestic or Foreign Stock Corporation (D) or (F) $300" },
    ],
  },
  MA: {
    title: "Massachusetts Annual Report: $500 for LLCs, $125 for Corporations",
    description:
      "Massachusetts LLCs file by the anniversary of formation for $500. Corporations file 2½ months after their fiscal year ends, for $125 or $100 online.",
    answer:
      "Massachusetts LLCs file an annual report by the anniversary of their original filing, for $500. Corporations file within 2½ months after their fiscal year ends, for $125, or $100 online.",
    llc: "A Massachusetts LLC files by the anniversary date of its certificate of organization. The state fee is $500.",
    more: [],
    facts: [
      { term: "LLCs", value: "$500, due on your formation anniversary" },
      { term: "Corporations", value: "$125 ($100 online), 2½ months after fiscal year end" },
    ],
    checked: "2026-11-17",
    sources: [
      {
        url: "https://www.sec.state.ma.us/divisions/corporations/filing-by-subject/limited-liability/corporations-limited-liability-company.htm",
        quote: "The filing fee for an annual report is five hundred dollars ($500.00).",
      },
      {
        url: "https://www.sec.state.ma.us/divisions/corporations/filing-by-subject/limited-liability/corporations-limited-liability-company.htm",
        quote: "on or before the anniversary date of the filing of its original certificate of organization.",
      },
      { url: "https://www.mass.gov/info-details/starting-a-corporation-in-massachusetts", quote: "2½ months after close of fiscal year" },
      { url: "https://www.mass.gov/info-details/starting-a-corporation-in-massachusetts", quote: "($100 if filed electronically)" },
    ],
  },
  NC: {
    title: "North Carolina Annual Report: $200 for LLCs, Due April 15",
    description:
      "North Carolina LLC annual reports are due April 15 each year after formation. State fee: $200 on paper, $203 online by card. Corporations: $25 or $21 online.",
    answer:
      "North Carolina LLC annual reports are due April 15 each year after the year of formation. The state fee is $200 on paper, or $203 online by card. Corporations pay $25 on paper or $21 online.",
    llc: "A North Carolina LLC files by April 15 of every year after the year it was formed. The online card price includes a $3 electronic filing fee.",
    more: [],
    facts: [
      { term: "LLC due date", value: "April 15 each year" },
      { term: "LLCs", value: "$200 on paper, $203 online" },
      { term: "Corporations", value: "$25 on paper, $21 online" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://sosnc.gov/frequently_asked_questions/by_title/_BRD_FAQ_Annual_Reports", quote: "Your report is due on April 15th of each year after the year of creation." },
      { url: "https://sosnc.gov/frequently_asked_questions/by_title/_BRD_FAQ_Annual_Reports", quote: "Fee includes a $3.00 electronic filing fee for credit cards." },
      { url: "https://www.ncleg.gov/EnactedLegislation/Statutes/PDF/BySection/Chapter_57D/GS_57D-2-24.pdf", quote: "by April 15 of each subsequent year until" },
    ],
  },
  NH: {
    title: "New Hampshire Annual Report: $100 Fee, Due April 1",
    description:
      "New Hampshire annual reports are due April 1 each year after registration. The fee is $100 for LLCs and corporations, with a $50 late fee after April 1.",
    answer:
      "New Hampshire annual reports are due April 1 each year after the year of registration. The fee is $100 for LLCs and corporations, with a $50 late fee after April 1.",
    llc: "A New Hampshire LLC pays the same $100 by April 1. Paying electronically adds a $2 handling charge.",
    more: [],
    facts: [
      { term: "Due", value: "April 1 each year" },
      { term: "State fee", value: "$100 for LLCs and corporations" },
      { term: "Late", value: "$50 after April 1" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://www.sos.nh.gov/corporations-0/business-faqs", quote: "is due by April 1st of each year following the year of registration." },
      { url: "https://gc.nh.gov/rsa/html/XXVIII/304-C/304-C-191.htm", quote: "a fee in the amount of $100" },
      { url: "https://gc.nh.gov/rsa/html/XXVII/293-A/293-A-122.htm", quote: "(8) Annual report $ 100" },
      {
        url: "https://www.sos.nh.gov/corporations-0/forms-and-fees/limited-liability-companies",
        quote: "all fees received electronically by the State of New Hampshire will be charged an additional $2.00 handling charge",
      },
    ],
  },
  TX: {
    title: "Texas Annual Report: Franchise Tax and Public Information Report, Due May 15",
    description:
      "Texas LLCs and corporations file no Secretary of State annual report. They file a franchise tax report and Public Information Report by May 15.",
    answer:
      "Texas has no Secretary of State annual report for LLCs or corporations. They file a franchise tax report, with a Public Information Report, with the Comptroller by May 15 each year.",
    llc: "A Texas LLC files the same way, by May 15. For 2026 and 2027 reports, a business with revenue at or below $2,650,000 owes no franchise tax and files just the Public Information Report.",
    more: ["A report filed after May 15 carries a $50 penalty."],
    facts: [
      { term: "Due", value: "May 15 each year" },
      { term: "Filed with", value: "The Comptroller, not the Secretary of State" },
      { term: "No tax due", value: "Revenue at or below $2,650,000 (2026 and 2027)" },
      { term: "Late filing", value: "$50 per report" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://www.sos.state.tx.us/corp/formationfaqs.shtml", quote: "Only certain types of entities file annual or periodic reports with the Secretary of State." },
      { url: "https://comptroller.texas.gov/taxes/franchise/", quote: "The annual franchise tax report is due May 15." },
      { url: "https://comptroller.texas.gov/taxes/franchise/pir-oir-filing-req.php", quote: "The PIR is due on the annual franchise tax report due date." },
      { url: "https://comptroller.texas.gov/taxes/franchise/", quote: "If you are at or below the no tax due threshold, simply file your 2026 Public Information Report or Ownership Report." },
      { url: "https://comptroller.texas.gov/taxes/franchise/", quote: "A $50 penalty is assessed on each report filed after the due date." },
    ],
  },
  WY: {
    title: "Wyoming Annual Report: $60 Minimum License Tax, Due Your Anniversary Month",
    description:
      "Wyoming annual reports are due the first day of your formation month. License tax: $60, or $.0002 of Wyoming assets if more. Unfiled after 60 days: dissolved.",
    answer:
      "Wyoming annual reports are due on the first day of the month your business was formed, starting the year after. The license tax is $60, or two-tenths of one mill on your Wyoming assets if that's more.",
    llc: "A Wyoming LLC files the same report and pays the same $60 minimum. If it isn't filed within 60 days of the due date, the state administratively dissolves the business.",
    more: [],
    facts: [
      { term: "Due", value: "First day of your formation month" },
      { term: "License tax", value: "$60, or $.0002 of Wyoming assets if more" },
      { term: "Not filed in 60 days", value: "Administratively dissolved" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://sos.wyo.gov/faqs.aspx?root=BUS", quote: "if your business registers or qualifies on January 15th, your annual report due date will be January 1st of each year." },
      { url: "https://sos.wyo.gov/faqs.aspx?root=BUS", quote: "The tax is $60 or two-tenths of one mill on the dollar ($.0002), whichever is greater." },
      { url: "https://sos.wyo.gov/faqs.aspx?root=BUS", quote: "If the annual report is not filed within sixty (60) days following the due date, the entity will be administratively dissolved." },
    ],
  },
  TN: {
    title: "Tennessee Annual Report: $300 Minimum for LLCs, $20 for Corporations",
    description:
      "Tennessee annual report fees: $20 for corporations, and $300 minimum for LLCs, plus $50 per member over 6, up to $3,000.",
    answer:
      "Tennessee charges corporations $20 for the annual report, plus $20 more if the registered agent or office changes. LLCs pay $300 minimum, plus $50 for each member over 6, up to $3,000.",
    llc: "A Tennessee LLC with 6 members or fewer pays $300. Each member over 6 adds $50, up to $3,000.",
    more: [],
    facts: [
      { term: "Corporations", value: "$20" },
      { term: "LLCs", value: "$300, up to $3,000 with more than 6 members" },
      { term: "Agent or office change", value: "$20 more" },
    ],
    checked: "2026-11-17",
    sources: [
      {
        url: "https://sos.tn.gov/businesses/faqs",
        quote: "The annual report fee for a corporation is $20, and an additional $20 is required if any change is made concerning the registered agent/registered office.",
      },
      {
        url: "https://sos.tn.gov/businesses/faqs",
        quote: "The fee increases by an additional $50 per member for every member over 6 members up to a maximum of $3,000.",
      },
    ],
  },
  WI: {
    title: "Wisconsin Annual Report: $25 Online, Due in Your Anniversary Quarter",
    description:
      "Wisconsin LLCs and corporations file each year during the calendar quarter of their registration anniversary. State fee: $25 online, $40 on paper.",
    answer:
      "Wisconsin LLCs and corporations file an annual report each year during the calendar quarter of their registration anniversary. The state fee is $25 online or $40 on paper.",
    llc: "A Wisconsin LLC pays the same $25 online. Its first report is due in the year after it registered.",
    more: [],
    facts: [
      { term: "Due", value: "The quarter of your registration anniversary" },
      { term: "State fee", value: "$25 online, $40 on paper" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx", quote: "Annual Report via Online Filing: $25.00" },
      {
        url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/FAQ.aspx",
        quote:
          "A domestic entity shall deliver its Annual Report to the Department in each year following the calendar year in which the entity registered, during the calendar year quarter in which the anniversary date of the registration occurs.",
      },
    ],
  },
  CA: {
    title: "California Annual Report (Statement of Information): $20 LLCs, $25 Corporations",
    description:
      "California's annual report is the Statement of Information: $25 every year for corporations, $20 every two years for LLCs, filed by your registration month.",
    answer:
      "California's annual report is called the Statement of Information. Corporations file it every year for $25, and LLCs every two years for $20, in the six months ending with the month the business registered.",
    llc: "A California LLC files its Statement of Information every two years for $20. The first one is due within 90 days of registering.",
    more: [],
    facts: [
      { term: "LLCs", value: "$20, every two years" },
      { term: "Corporations", value: "$25, every year" },
      { term: "When", value: "The 6 months ending with your registration month" },
    ],
    checked: "2026-11-17",
    sources: [
      { url: "https://www.sos.ca.gov/business-programs/business-entities/faqs", quote: "all Limited Liability Companies are required to file every two years in the month of registration." },
      {
        url: "https://www.sos.ca.gov/business-programs/cannabizfile/cannabis-forms-and-fees/limited-liability-companies-llc-california",
        quote: "Due within 90 days of initial registration and every two years thereafter.",
      },
      { url: "https://www.sos.ca.gov/business-programs/business-entities/statements", quote: "Statutory Required 6 Month Filing Window" },
    ],
  },
};

export function stateAnswer(code: string): StateAnswer | null {
  return STATE_ANSWERS[code.toUpperCase()] ?? null;
}

/** "November 17, 2026". */
export function stateAnswerCheckedLabel(a: Pick<StateAnswer, "checked">): string {
  return new Date(`${a.checked}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
