/**
 * Internal pricing reference. NOT for publication: every row is a provisional research
 * input until someone re-checks it on the provider's own site and records the date.
 * Competitor comparisons may appear on public pages only after that fresh check.
 */

export interface PriceBenchmark {
  provider: string;
  service: "registered_agent";
  firstYearCents: number | null;
  renewalCents: number | null;
  included: string;
  sourceUrl: string | null;
  /** Date checked on the provider's own site; null = never checked there. */
  checkedOn: string | null;
  promotionalConditions: string | null;
  comparable: boolean;
  notes: string;
}

export const RA_BENCHMARKS: PriceBenchmark[] = [
  {
    provider: "Northwest Registered Agent",
    service: "registered_agent",
    firstYearCents: 12500,
    renewalCents: 12500,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: null,
    comparable: true,
    notes: "From a third-party comparison collected Oct 20, 2026. Not verified on Northwest's site.",
  },
  {
    provider: "Harbor Compliance",
    service: "registered_agent",
    firstYearCents: 9900,
    renewalCents: 15900,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: "Introductory first-year price, higher renewal",
    comparable: true,
    notes: "Provisional research input. Not verified.",
  },
  {
    provider: "Bizee",
    service: "registered_agent",
    firstYearCents: 14900,
    renewalCents: null,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: null,
    comparable: true,
    notes: "Approximate standalone price. Not verified.",
  },
  {
    provider: "ZenBusiness",
    service: "registered_agent",
    firstYearCents: null,
    renewalCents: null,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: "Promotional first year, higher renewal",
    comparable: false,
    notes: "Prices not recorded. Not verified.",
  },
  {
    provider: "LegalZoom",
    service: "registered_agent",
    firstYearCents: 24900,
    renewalCents: null,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: null,
    comparable: true,
    notes: "Approximate. Not verified.",
  },
  {
    provider: "Texan Registered Agent",
    service: "registered_agent",
    firstYearCents: 3500,
    renewalCents: null,
    included: "Not checked",
    sourceUrl: null,
    checkedOn: null,
    promotionalConditions: null,
    comparable: false,
    notes: "Texas only. Not verified.",
  },
];
