import "server-only";
import { resolveServicePrice } from "@/lib/domain/pricing";
import { listActivePrices } from "@/lib/filings/rules-db";
import { SERVICES, STANDARD_PRICE_VARIANT, type ServiceCode } from "./catalog";

/**
 * Nationwide list prices for the public pages, read from service_prices (the same rows
 * checkout charges). A service with no active row shows no price rather than a guess.
 */
export async function publicServicePrices(): Promise<Partial<Record<ServiceCode, number>>> {
  const prices = await listActivePrices();
  const out: Partial<Record<ServiceCode, number>> = {};
  for (const code of ["registered_agent", "ra_annual_report_bundle", "formation", "change_registered_agent"] as const) {
    const p = resolveServicePrice(prices, { filingTypeCode: SERVICES[code].filingTypeCode, stateCode: null, entityType: null, variant: STANDARD_PRICE_VARIANT });
    if (p) out[code] = p.serviceFeeCents;
  }
  return out;
}
