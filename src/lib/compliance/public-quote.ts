import "server-only";
import { isProductionEnvironment } from "@/config/site";
import { getJurisdiction } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { buildQuote, governmentFeeFor, resolveServicePrice, type Quote } from "@/lib/domain/pricing";
import { listActivePrices } from "@/lib/filings/rules-db";

/**
 * Public price quote for a rule, for marketing pages and the lookup result. Returns
 * null when no service price is configured or the database is unreachable — pages
 * must then show the state fee only and say the service fee is shown at checkout.
 */
export async function publicQuote(rule: ComplianceRuleDef, opts: { isNonprofit?: boolean } = {}): Promise<Quote | null> {
  const prices = await listActivePrices();
  const price = resolveServicePrice(prices, {
    filingTypeCode: rule.filingTypeCode,
    stateCode: rule.stateCode,
    entityType: rule.entityType,
  });
  if (!price) return null;
  // A provisional (unapproved) price may be previewed on staging, never advertised on
  // the production deployment (indexed or not).
  if (!price.approved && isProductionEnvironment()) return null;
  return buildQuote({
    stateName: getJurisdiction(rule.stateCode)?.name ?? rule.stateCode,
    filingName: rule.filingName,
    governmentFeeCents: governmentFeeFor(rule, { isNonprofit: Boolean(opts.isNonprofit) }),
    price,
  });
}
