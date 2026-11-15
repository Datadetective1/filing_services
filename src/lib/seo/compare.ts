/**
 * Filewell compared with the best-known filing services. Every competitor figure was read on the
 * competitor's own public page on `checked`; nothing comes from review sites or memory. Their
 * prices can change, so each page says when they were read and that they may have changed.
 *
 * Keep it factual and neutral: list what they include that we don't (such as covered state fees),
 * and never call a competitor bad, late or misleading.
 */

export const COMPARE_CHECKED = "2026-11-15";

export interface CompetitorFacts {
  slug: string;
  name: string;
  /** Registered agent, the first year. Display text quoted from their page. */
  raFirstYear: string;
  /** Registered agent, each later year. */
  raRenewal: string;
  /** For the two-year cost bars: first year plus one renewal, in cents, before any state fee. */
  raTwoYearCents: number;
  /** Whether the two-year figure leaves out a fee their page mentions. */
  raTwoYearNote?: string;
  /** Annual report filing, their fee. */
  report: string;
  /** Switching agents, when their page says. */
  switching: string;
  /** Where they do more than Filewell, said plainly. */
  theyInclude: string[];
  /** The pages the figures were read on, named, not linked. */
  sources: string[];
}

export const COMPETITORS: CompetitorFacts[] = [
  {
    slug: "legalzoom",
    name: "LegalZoom",
    raFirstYear: "$249",
    raRenewal: "$249, auto-renews at the purchase rate (LegalZoom says the renewal rate is subject to change)",
    raTwoYearCents: 49800,
    report: "$99 plus state filing fees",
    switching: "Paperwork and state fees covered",
    theyInclude: [
      "When you switch agents, LegalZoom says it covers the state fee. Filewell passes the state's fee through at cost.",
      "Attorney help and other legal products, if you want them from the same company.",
    ],
    sources: ["LegalZoom, Registered Agent Services page", "LegalZoom, File an Annual Report page"],
  },
  {
    slug: "zenbusiness",
    name: "ZenBusiness",
    raFirstYear: "$99 plus state fees",
    raRenewal: "$199",
    raTwoYearCents: 29800,
    raTwoYearNote: "plus the first year's state fees",
    report: "$100 plus state fees",
    switching: "Not stated on the pages we read",
    theyInclude: [
      "A lower first year for registered agent: $99 plus state fees. From the second year it's $199.",
      "Formation plans and other business tools in one dashboard.",
    ],
    sources: ["ZenBusiness, Registered Agent Service page", "ZenBusiness, Annual Report Filing page"],
  },
  {
    slug: "northwest",
    name: "Northwest Registered Agent",
    raFirstYear: "$125",
    raRenewal: "$125 ($100 a year per state for five or more states)",
    raTwoYearCents: 25000,
    report: "$100 plus state fees",
    switching: "Not stated on the pages we read",
    theyInclude: [
      "A volume price: $100 a year per state when you use them in five or more states.",
      "Their page says the price hasn't gone up in 20 years.",
    ],
    sources: ["Northwest Registered Agent, Registered Agent page", "Northwest Registered Agent, Annual Report Service page"],
  },
  {
    slug: "bizee",
    name: "Bizee",
    raFirstYear: "$149 on its own (free the first year when you form with Bizee)",
    raRenewal: "$149",
    raTwoYearCents: 29800,
    raTwoYearNote: "on its own, without forming there",
    report: "A flat fee, but no price shown on the pages we read",
    switching: "Not stated on the pages we read",
    theyInclude: [
      "A free first year of registered agent when you form your business with Bizee.",
      "Formation packages starting at $0 plus the state fee.",
    ],
    sources: ["Bizee, Registered Agent page", "Bizee, Texas Registered Agent page", "Bizee, Annual Report page"],
  },
  {
    slug: "registered-agents-inc",
    name: "Registered Agents Inc",
    raFirstYear: "$200",
    raRenewal: "$200",
    raTwoYearCents: 40000,
    report: "Included with registered agent, you pay only the state fee",
    switching: "Not stated on the pages we read",
    theyInclude: [
      "Annual report filing included in the $200 a year, so you pay only the state fee.",
    ],
    sources: [
      "Registered Agents Inc, State Filings page",
      "Registered Agents Inc, Florida, Wisconsin, Delaware and Michigan pages",
    ],
  },
  {
    slug: "harbor-compliance",
    name: "Harbor Compliance",
    raFirstYear: "$99 for new customers",
    raRenewal: "$159",
    raTwoYearCents: 25800,
    report: "$199 per state plus filing fees",
    switching: "Help with switching offered, fee not stated",
    theyInclude: [
      "A lower first year for registered agent: $99 for new customers. It renews at $159.",
      "Two or three years prepaid at $99 a year, then $159.",
      "Volume discounts on annual reports when you order online.",
    ],
    sources: ["Harbor Compliance, Registered Agent Service page", "Harbor Compliance, Annual Report page"],
  },
];

export function competitorBySlug(slug: string): CompetitorFacts | null {
  return COMPETITORS.find((c) => c.slug === slug) ?? null;
}

export function comparePath(c: CompetitorFacts): string {
  return `/compare/filewell-vs-${c.slug}`;
}

export function competitorBySlugPath(param: string): CompetitorFacts | null {
  const m = /^filewell-vs-([a-z0-9-]+)$/.exec(param);
  return m ? competitorBySlug(m[1]) : null;
}

/** "Read on November 15, 2026 from each company's own pages." */
export function checkedLabel(): string {
  const d = new Date(`${COMPARE_CHECKED}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
