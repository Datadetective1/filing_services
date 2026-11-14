import { formatCents } from "@/lib/domain/money";

const money = (c: number) => formatCents(c, { trimZeros: true });

/** Our fee across places: "$49", or "$49 or $99" when it depends on the state. Null when nothing is open. */
export function serviceFeeText(places: { serviceCents: number }[]): { lowest: string; all: string } | null {
  const fees = [...new Set(places.map((p) => p.serviceCents))].sort((a, b) => a - b);
  if (fees.length === 0) return null;
  const lowest = money(fees[0]);
  if (fees.length === 1) return { lowest, all: lowest };
  if (fees.length === 2) return { lowest, all: `${lowest} or ${money(fees[1])}` };
  return { lowest, all: `${lowest} to ${money(fees[fees.length - 1])}` };
}
