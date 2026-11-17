/**
 * Other companies' published prices for filing one state's annual report, shown beside ours on
 * that state's guide. Each price was read on the company's own page for that state on the date
 * given; a company with no state-specific published price is left out. Sales pages never link
 * a state's filing site, and these rows link nowhere either.
 */

export interface ReportPriceRow {
  name: string;
  /** The company's own service fee, before the state fee. */
  serviceCents: number;
  /** Where the price was read, in words (no link). */
  source: string;
  checked: string;
}

export const REPORT_PRICE_COMPARISONS: Record<string, ReportPriceRow[]> = {
  PA: [
    {
      name: "Northwest Registered Agent",
      // "For $100 plus the state-mandated report fee, we'll file your annual report. For most businesses, that's $107 total."
      serviceCents: 10000,
      source: "its own Pennsylvania annual report page",
      checked: "2026-11-17",
    },
  ],
};

export function reportPriceComparison(code: string): ReportPriceRow[] {
  return REPORT_PRICE_COMPARISONS[code.toUpperCase()] ?? [];
}

/** "November 17, 2026" from "2026-11-17". */
export function checkedLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
