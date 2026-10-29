import { SERVICES, type FulfillmentMethod, type ServiceCode } from "./catalog";

/**
 * Unit economics. Pure functions, integer cents.
 *
 * Government fees are pass-through money: collected from the customer and remitted to the
 * state. They are never revenue and never contribution. Any difference between what was
 * collected and what was remitted is reported separately as a balance owed (or owing), not
 * as profit.
 *
 * Payment processing fees apply to the whole charge, government fee included, so they are a
 * real cost of every order. Where the processor's actual fee is known (Stripe balance
 * transaction), it is used; otherwise an estimate is used and flagged as such.
 */

/** Illustrative card pricing (2.9% + 30 cents). Used only when the actual fee is unknown. */
export const ESTIMATED_CARD_RATE = 0.029;
export const ESTIMATED_CARD_FIXED_CENTS = 30;

export function estimateProcessingFeeCents(chargeCents: number): number {
  if (!Number.isInteger(chargeCents) || chargeCents < 0) throw new Error("Invalid charge amount");
  if (chargeCents === 0) return 0;
  return Math.round(chargeCents * ESTIMATED_CARD_RATE) + ESTIMATED_CARD_FIXED_CENTS;
}

export interface EconomicsLine {
  serviceCode: ServiceCode;
  fulfillmentMethod: FulfillmentMethod;
  /** Filewell's own charges (excluding government fees and taxes). */
  serviceRevenueCents: number;
  governmentFeesCollectedCents: number;
  governmentFeesRemittedCents: number;
  wholesaleCostCents: number;
  /** Costs Filewell absorbs to win the customer (e.g. the provider's change-of-agent charge). */
  acquisitionCostCents: number;
  processingFeeCents: number;
  processingFeeSource: "actual" | "estimated";
  serviceRefundsCents: number;
  governmentRefundsCents: number;
  /** Sales tax collected (a liability, never revenue). */
  taxCollectedCents: number;
}

export interface EconomicsResult {
  netServiceRevenueCents: number;
  contributionCents: number;
  /** null when there is no net service revenue to divide by. */
  contributionMarginPct: number | null;
  /** Government money held: collected minus remitted minus refunded. Should settle to zero. */
  governmentFeeBalanceCents: number;
}

export function contribution(line: EconomicsLine): EconomicsResult {
  const net = line.serviceRevenueCents - line.serviceRefundsCents;
  const contributionCents = net - line.wholesaleCostCents - line.acquisitionCostCents - line.processingFeeCents;
  return {
    netServiceRevenueCents: net,
    contributionCents,
    contributionMarginPct: net > 0 ? Math.round((contributionCents / net) * 1000) / 10 : null,
    governmentFeeBalanceCents: line.governmentFeesCollectedCents - line.governmentFeesRemittedCents - line.governmentRefundsCents,
  };
}

/** Sum several lines (e.g. a report over many orders). */
export function sumEconomics(lines: EconomicsLine[]): EconomicsResult & { lines: number; estimatedFeeLines: number } {
  const t = lines.reduce(
    (a, l) => {
      const r = contribution(l);
      a.net += r.netServiceRevenueCents;
      a.contribution += r.contributionCents;
      a.gov += r.governmentFeeBalanceCents;
      if (l.processingFeeSource === "estimated") a.estimated += 1;
      return a;
    },
    { net: 0, contribution: 0, gov: 0, estimated: 0 },
  );
  return {
    netServiceRevenueCents: t.net,
    contributionCents: t.contribution,
    contributionMarginPct: t.net > 0 ? Math.round((t.contribution / t.net) * 1000) / 10 : null,
    governmentFeeBalanceCents: t.gov,
    lines: lines.length,
    estimatedFeeLines: t.estimated,
  };
}

export interface ContributionEstimate {
  serviceCode: ServiceCode;
  label: string;
  serviceFeeCents: number;
  governmentFeeCents: number;
  wholesaleCents: number;
  acquisitionCents: number;
  processingFeeCents: number;
  contributionCents: number;
  marginPct: number | null;
}

/**
 * Planning estimate for one sale at proposed prices, with an illustrative state fee.
 * Example: registered agent at $119, $45 wholesale, estimated card fee $3.75: $70.25.
 */
export function estimateContribution(input: {
  serviceCode: ServiceCode;
  label: string;
  serviceFeeCents: number;
  governmentFeeCents?: number;
  wholesaleCents?: number;
  acquisitionCents?: number;
}): ContributionEstimate {
  const gov = input.governmentFeeCents ?? 0;
  const wholesale = input.wholesaleCents ?? SERVICES[input.serviceCode].wholesaleCents ?? 0;
  const acquisition = input.acquisitionCents ?? 0;
  const fee = estimateProcessingFeeCents(input.serviceFeeCents + gov);
  const r = contribution({
    serviceCode: input.serviceCode,
    fulfillmentMethod: "registered_agents_inc",
    serviceRevenueCents: input.serviceFeeCents,
    governmentFeesCollectedCents: gov,
    governmentFeesRemittedCents: gov,
    wholesaleCostCents: wholesale,
    acquisitionCostCents: acquisition,
    processingFeeCents: fee,
    processingFeeSource: "estimated",
    serviceRefundsCents: 0,
    governmentRefundsCents: 0,
    taxCollectedCents: 0,
  });
  return {
    serviceCode: input.serviceCode,
    label: input.label,
    serviceFeeCents: input.serviceFeeCents,
    governmentFeeCents: gov,
    wholesaleCents: wholesale,
    acquisitionCents: acquisition,
    processingFeeCents: fee,
    contributionCents: r.contributionCents,
    marginPct: r.contributionMarginPct,
  };
}

/** The planning table shown in /admin/economics and the PR, at proposed prices. */
export function proposedPriceEstimates(): ContributionEstimate[] {
  return [
    estimateContribution({ serviceCode: "registered_agent", label: "Registered agent, any year", serviceFeeCents: 11900 }),
    estimateContribution({
      serviceCode: "change_registered_agent",
      label: "Switch to Filewell (year one): $119 service + $25 absorbed, $10 state fee",
      serviceFeeCents: 11900,
      governmentFeeCents: 1000,
      wholesaleCents: 4500,
      acquisitionCents: 2500,
    }),
    estimateContribution({
      serviceCode: "ra_annual_report_bundle",
      label: "Bundle, self-filed annual report ($169; state fee charged at filing)",
      serviceFeeCents: 16900,
      wholesaleCents: 4500,
    }),
    estimateContribution({
      serviceCode: "ra_annual_report_bundle",
      label: "Bundle, annual report sent to the provider",
      serviceFeeCents: 16900,
      wholesaleCents: 4500 + 7500,
    }),
    estimateContribution({ serviceCode: "formation", label: "Formation alone ($99, provider files it)", serviceFeeCents: 9900 }),
    estimateContribution({
      serviceCode: "annual_report",
      label: "Annual report today ($49, self-filed)",
      serviceFeeCents: 4900,
      wholesaleCents: 0,
    }),
    estimateContribution({
      serviceCode: "annual_report",
      label: "Annual report proposed ($79, self-filed)",
      serviceFeeCents: 7900,
      wholesaleCents: 0,
    }),
    estimateContribution({
      serviceCode: "annual_report",
      label: "Annual report proposed ($79) if sent to the provider",
      serviceFeeCents: 7900,
      wholesaleCents: 7500,
    }),
  ];
}
