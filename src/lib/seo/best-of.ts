import { formatCents } from "@/lib/domain/money";
import { COMPARE_CHECKED, comparePath, COMPETITORS, type CompetitorFacts } from "@/lib/seo/compare";

/**
 * The two "best of" roundups. Every competitor figure comes from compare.ts (read on each
 * company's own site on COMPARE_CHECKED); Filewell's side comes from the live prices. Nothing
 * here is a ranking by quality: rows are ordered by price, and each says who it suits.
 *
 * Sales pages never link or point to a state's own filing site, so the "file it yourself" row
 * says it exists and names no address.
 */

export type BestOfKind = "annual-report" | "registered-agent";

export const BEST_OF_PATHS: Record<BestOfKind, string> = {
  "annual-report": "/best-annual-report-filing-services",
  "registered-agent": "/best-registered-agent-services",
};

/** The year in the headline follows the date the prices were read. */
export const BEST_OF_YEAR = COMPARE_CHECKED.slice(0, 4);

export interface FilewellSide {
  raCents: number;
  /** Lowest-first fee tiers: [{ serviceCents: 4900, states: 6 }, { serviceCents: 9900, states: 27 }]. */
  reportTiers: { serviceCents: number; states: number }[];
}

export interface BestOfRow {
  name: string;
  ours: boolean;
  /** Link to our one-on-one comparison, for competitors. */
  path: string | null;
  /** Cells after the name, as display text. */
  cells: string[];
  /** For the bars: cents, or null when the company shows no price. */
  barCents: number | null;
  barNote?: string;
  bestFor: string;
}

const money = (c: number) => formatCents(c, { trimZeros: true });

function reportBestFor(c: CompetitorFacts): string {
  switch (c.slug) {
    case "legalzoom":
      return "Owners who also want attorney help from the same company";
    case "zenbusiness":
      return "Owners who want formation and other tools in one dashboard";
    case "northwest":
      return "Owners who want one company for many states";
    case "bizee":
      return "Owners who formed their business with Bizee";
    case "harbor-compliance":
      return "Companies filing in many states, with volume discounts";
    default:
      return "";
  }
}

function raBestFor(c: CompetitorFacts): string {
  switch (c.slug) {
    case "legalzoom":
      return "Switchers who want the state's change fee covered";
    case "zenbusiness":
      return "A low first year, if you plan to leave after it";
    case "northwest":
      return "Five or more states, at $100 a year each";
    case "bizee":
      return "New businesses forming with Bizee (free first year)";
    case "harbor-compliance":
      return "Prepaying two or three years at $99 a year";
    default:
      return "";
  }
}

export function annualReportRows(f: FilewellSide): BestOfRow[] {
  const low = f.reportTiers[0];
  const high = f.reportTiers[f.reportTiers.length - 1];
  const oursFee =
    f.reportTiers.length > 1
      ? `${money(low.serviceCents)} in ${low.states} ${low.states === 1 ? "state" : "states"}, ${money(high.serviceCents)} in ${f.reportTiers.slice(1).reduce((n, t) => n + t.states, 0)} more`
      : `${money(low.serviceCents)} in ${low.states} ${low.states === 1 ? "state" : "states"}`;
  const ours: BestOfRow = {
    name: "Filewell",
    ours: true,
    path: null,
    cells: [oursFee, "Passed through at cost, shown as its own line", "A person checks every filing; reminders before the next one"],
    barCents: low.serviceCents,
    barNote: f.reportTiers.length > 1 ? `in ${low.states} states` : undefined,
    bestFor: `The lowest service fee here, in the ${low.states === 1 ? "state" : `${low.states} states`} where we file ourselves`,
  };
  const theirs: BestOfRow[] = COMPETITORS.map((c) => ({
    name: c.name,
    ours: false,
    path: comparePath(c),
    cells: [c.reportCents !== undefined ? money(c.reportCents) : "No price shown on the pages we read", "Added on top", c.report],
    barCents: c.reportCents ?? null,
    bestFor: reportBestFor(c),
  }));
  return [ours, ...theirs].sort((a, b) => (a.barCents ?? Infinity) - (b.barCents ?? Infinity));
}

export function registeredAgentRows(f: FilewellSide): BestOfRow[] {
  const ours: BestOfRow = {
    name: "Filewell",
    ours: true,
    path: null,
    cells: [money(f.raCents), `${money(f.raCents)}, the same every year`, money(f.raCents * 2)],
    barCents: f.raCents * 2,
    bestFor: "One price that doesn't change at renewal; switching costs only the state's fee",
  };
  const theirs: BestOfRow[] = COMPETITORS.map((c) => ({
    name: c.name,
    ours: false,
    path: comparePath(c),
    cells: [c.raFirstYear, c.raRenewal, `${money(c.raTwoYearCents)}${c.raTwoYearNote ? ` ${c.raTwoYearNote}` : ""}`],
    barCents: c.raTwoYearCents,
    barNote: c.raTwoYearNote,
    bestFor: raBestFor(c),
  }));
  return [ours, ...theirs].sort((a, b) => (a.barCents ?? Infinity) - (b.barCents ?? Infinity));
}

/** Names of the rows with the lowest bar, for a plain-language answer ("Filewell", or "A and B"). */
export function cheapest(rows: BestOfRow[]): { names: string; cents: number } | null {
  const priced = rows.filter((r) => r.barCents !== null);
  if (priced.length === 0) return null;
  const min = Math.min(...priced.map((r) => r.barCents as number));
  const names = priced.filter((r) => r.barCents === min).map((r) => r.name);
  return { names: names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0], cents: min };
}
