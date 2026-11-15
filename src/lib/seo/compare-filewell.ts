import "server-only";
import { formatCents } from "@/lib/domain/money";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { annualReportPlaces } from "@/lib/services/state-services";

export interface FilewellFacts {
  raCents: number;
  /** "$49 plus the state fee in 9 states, $99 plus the state fee in 24 more". */
  report: string;
  reportFromCents: number;
  reportStates: number;
}

/** Filewell's own side of a comparison, from the live prices checkout charges. Null when not sold. */
export async function filewellFacts(): Promise<FilewellFacts | null> {
  if (!businessServicesPagesEnabled()) return null;
  const [prices, places] = await Promise.all([publicServicePrices(), annualReportPlaces()]);
  const ra = prices.registered_agent;
  if (ra === undefined || places.length === 0) return null;
  const byFee = new Map<number, number>();
  for (const p of places) byFee.set(p.serviceCents, (byFee.get(p.serviceCents) ?? 0) + 1);
  const tiers = [...byFee.entries()].sort((a, b) => a[0] - b[0]);
  const report = tiers
    .map(([cents, n], i) => `${formatCents(cents, { trimZeros: true })} plus the state fee in ${n}${i > 0 ? " more" : ""} ${n === 1 ? "state" : "states"}`)
    .join(", ");
  return { raCents: ra, report, reportFromCents: tiers[0][0], reportStates: places.length };
}
