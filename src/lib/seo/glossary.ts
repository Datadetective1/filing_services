/**
 * Plain definitions of the filing words small business owners search for. Each answer comes
 * first and stands alone, so search engines and AI assistants can quote it. Only general,
 * long-settled facts live here: no state fee, date or rule that could change. State specifics
 * stay on the verified state pages the "learn more" links point to.
 */

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Other names people search for. */
  aka?: string[];
  /** One or two sentences that answer "what is ...". */
  definition: string;
  /** Why it matters to the owner, in a sentence or two. */
  matters: string;
  /** A Filewell page that helps with it. */
  link?: { href: string; label: string };
}

export const GLOSSARY_CHECKED = "2026-11-18";

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "annual-report",
    term: "Annual report",
    aka: ["Annual registration", "Statement of information", "Annual list", "Periodic report"],
    definition:
      "A short filing most states require from LLCs and corporations to keep the public record current: the business's addresses, its registered agent and, in many states, its managers, members or officers.",
    matters:
      "It is not a financial report. Missing it usually means a late fee, and in many states the business can lose good standing or be dissolved.",
    link: { href: "/annual-report/due-dates", label: "Due dates and state fees by state" },
  },
  {
    slug: "biennial-report",
    term: "Biennial report",
    definition: "The same filing as an annual report, in states that ask for it every two years instead of every year.",
    matters: "It is easy to forget a filing that comes up every other year, so a reminder helps.",
    link: { href: "/annual-report/due-dates", label: "See which states ask for it" },
  },
  {
    slug: "registered-agent",
    term: "Registered agent",
    aka: ["Statutory agent", "Resident agent", "Agent for service of process"],
    definition:
      "The person or company named on the state's record to receive lawsuits and official state mail for a business. It needs a physical street address in that state and must be available during business hours.",
    matters:
      "Every LLC and corporation needs one in each state where it is registered. Using a service keeps your home address off the public record and makes sure legal papers are not missed.",
    link: { href: "/registered-agent", label: "Registered agent service" },
  },
  {
    slug: "service-of-process",
    term: "Service of process",
    definition: "The formal delivery of legal papers, such as a lawsuit, to a business. For an LLC or corporation it is usually delivered to the registered agent.",
    matters: "If papers are delivered and nobody passes them on, a court case can go ahead without the business knowing.",
    link: { href: "/registered-agent", label: "How a registered agent handles it" },
  },
  {
    slug: "change-of-registered-agent",
    term: "Change of registered agent",
    aka: ["Statement of change", "Change of registered office"],
    definition: "A filing that tells the state a business has a new registered agent or agent address.",
    matters: "Some states charge a small fee for it and some don't. Switching agents does not change anything else about the business.",
    link: { href: "/registered-agent", label: "Switch your registered agent" },
  },
  {
    slug: "good-standing",
    term: "Good standing",
    aka: ["Active status", "Certificate of good standing", "Certificate of status", "Certificate of existence"],
    definition: "The state's way of saying a business is current on its required filings and fees. A certificate of good standing is the document that proves it.",
    matters: "Banks, lenders, landlords and other states often ask for proof of good standing. A missed annual report is one of the most common reasons to lose it.",
    link: { href: "/find", label: "Check what your business owes" },
  },
  {
    slug: "administrative-dissolution",
    term: "Administrative dissolution",
    aka: ["Revocation", "Forfeiture", "Inactive status"],
    definition:
      "When a state ends a business's legal existence on its record, most often because annual reports, fees or a registered agent were missing.",
    matters:
      "A dissolved business can lose the protection of its LLC or corporation and the right to its name. Many states allow reinstatement, usually with back filings and fees.",
    link: { href: "/annual-report", label: "File an overdue annual report" },
  },
  {
    slug: "reinstatement",
    term: "Reinstatement",
    definition: "A filing that brings a dissolved or revoked business back to active status on the state's record.",
    matters: "It usually costs more than filing on time, because the state asks for the missed reports and fees as well.",
  },
  {
    slug: "articles-of-organization",
    term: "Articles of organization",
    aka: ["Certificate of formation", "Certificate of organization"],
    definition: "The document filed with a state to create an LLC. For a corporation the matching document is usually called articles of incorporation.",
    matters: "Once the state accepts it, the LLC exists and its ongoing filings, such as annual reports, begin.",
    link: { href: "/business-formation", label: "Start an LLC" },
  },
  {
    slug: "operating-agreement",
    term: "Operating agreement",
    definition: "An LLC's internal rulebook: who owns what, who makes decisions and what happens if someone leaves.",
    matters: "Most states don't ask you to file it, but banks and partners often ask to see one.",
  },
  {
    slug: "foreign-qualification",
    term: "Foreign qualification",
    aka: ["Foreign registration", "Certificate of authority"],
    definition: "Registering a business formed in one state so it can do business in another state. Foreign here means from another state, not another country.",
    matters: "A foreign-registered business usually needs a registered agent and annual reports in the second state too.",
    link: { href: "/registered-agent", label: "Registered agent in every state" },
  },
  {
    slug: "principal-office",
    term: "Principal office",
    definition: "The main address where a business is run, as shown on the state's record. It can be different from the registered agent's address.",
    matters: "It appears on annual reports and is often public, so many owners use a business address instead of a home address.",
  },
  {
    slug: "franchise-tax",
    term: "Franchise tax",
    definition: "A yearly tax or tax report some states charge for the right to exist or do business there. Some states ask for it in place of an annual report and some in addition to one.",
    matters: "It is separate from income tax, and it can be due even when the business made no money.",
    link: { href: "/states", label: "Requirements by state" },
  },
];
