import type { EntityType } from "./types";

/**
 * Pricing. The government fee comes from the compliance rule version; our service
 * fee comes from admin-configurable service_prices rows. They are always itemized
 * separately — the state fee is never folded into our fee.
 */

export interface ServicePrice {
  id: string;
  filingTypeCode: string;
  stateCode: string | null;
  entityType: string | null;
  serviceFeeCents: number;
  approved: boolean;
  active: boolean;
}

export interface QuoteLineItem {
  kind: "government_fee" | "service_fee";
  description: string;
  amountCents: number;
}

export interface Quote {
  currency: "usd";
  governmentFeeCents: number;
  serviceFeeCents: number;
  totalCents: number;
  lineItems: QuoteLineItem[];
  servicePriceId: string;
  servicePriceApproved: boolean;
}

/** Most specific active price wins: state+entity > state > entity > global. */
export function resolveServicePrice(
  prices: ServicePrice[],
  scope: { filingTypeCode: string; stateCode: string; entityType: EntityType },
): ServicePrice | null {
  const candidates = prices.filter(
    (p) =>
      p.active &&
      p.filingTypeCode === scope.filingTypeCode &&
      (p.stateCode === null || p.stateCode === scope.stateCode) &&
      (p.entityType === null || p.entityType === scope.entityType),
  );
  const score = (p: ServicePrice) => (p.stateCode ? 2 : 0) + (p.entityType ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0] ?? null;
}

export function governmentFeeFor(
  rule: { stateFeeCents: number; nonprofitStateFeeCents?: number | null },
  business: { isNonprofit: boolean },
): number {
  if (business.isNonprofit && rule.nonprofitStateFeeCents !== null && rule.nonprofitStateFeeCents !== undefined) {
    return rule.nonprofitStateFeeCents;
  }
  return rule.stateFeeCents;
}

export function buildQuote(input: {
  stateName: string;
  filingName: string;
  governmentFeeCents: number;
  price: ServicePrice;
}): Quote {
  const { governmentFeeCents, price } = input;
  if (!Number.isInteger(governmentFeeCents) || governmentFeeCents < 0) {
    throw new Error("Invalid government fee");
  }
  if (!Number.isInteger(price.serviceFeeCents) || price.serviceFeeCents < 0) {
    throw new Error("Invalid service fee");
  }
  return {
    currency: "usd",
    governmentFeeCents,
    serviceFeeCents: price.serviceFeeCents,
    totalCents: governmentFeeCents + price.serviceFeeCents,
    lineItems: [
      {
        kind: "government_fee",
        description: `${input.stateName} ${input.filingName}: state filing fee, paid to the state`,
        amountCents: governmentFeeCents,
      },
      {
        kind: "service_fee",
        description: `Filing service fee: preparation and submission`,
        amountCents: price.serviceFeeCents,
      },
    ],
    servicePriceId: price.id,
    servicePriceApproved: price.approved,
  };
}
