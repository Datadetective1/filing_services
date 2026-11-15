import "server-only";
import { isProductionEnvironment } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { SERVICES } from "@/lib/services/catalog";
import { publicServicePrices } from "@/lib/services/public-prices";
import { annualReportPlaces } from "@/lib/services/state-services";

export interface FilewellFacts {
  raCents: number;
  /** "$49 plus the state fee in 9 states, $99 plus the state fee in 24 more states". */
  report: string;
  reportFromCents: number;
  reportStates: number;
}

export function reportTiers(places: { serviceCents: number }[]): string {
  const byFee = new Map<number, number>();
  for (const p of places) byFee.set(p.serviceCents, (byFee.get(p.serviceCents) ?? 0) + 1);
  return [...byFee.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cents, n], i) => `${formatCents(cents, { trimZeros: true })} plus the state fee in ${n}${i > 0 ? " more" : ""} ${n === 1 ? "state" : "states"}`)
    .join(", ");
}

/**
 * Filewell's own side of a comparison, from the live prices checkout charges. Null on production
 * when either isn't sold. Previews (whose database holds no prices) fall back to the catalog's
 * prices so the page can be reviewed there; production never does.
 */
export async function filewellFacts(): Promise<FilewellFacts | null> {
  if (!businessServicesPagesEnabled()) return null;
  const [prices, places] = await Promise.all([publicServicePrices().catch(() => ({}) as Awaited<ReturnType<typeof publicServicePrices>>), annualReportPlaces().catch(() => [])]);
  let ra = prices.registered_agent;
  let tiers: { serviceCents: number }[] = places;
  if (!isProductionEnvironment()) {
    ra ??= SERVICES.registered_agent.proposedServiceFeeCents ?? undefined;
    const fallback = SERVICES.annual_report.proposedServiceFeeCents;
    if (tiers.length === 0 && fallback !== null) tiers = [{ serviceCents: fallback }];
  }
  if (ra === undefined || tiers.length === 0) return null;
  return {
    raCents: ra,
    report: reportTiers(tiers),
    reportFromCents: Math.min(...tiers.map((t) => t.serviceCents)),
    reportStates: tiers.length,
  };
}
