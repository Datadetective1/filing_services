import type { RaSituation } from "@/lib/registered-agent/sales";
import type { ServiceCode } from "./catalog";

/**
 * Order summaries for business services. Pure: prices come in as resolved service_prices
 * rows and verified government fees, so the same function drives the checkout page, the
 * stored order snapshot and the Stripe line items.
 *
 * Every summary shows, separately: Filewell's service charge, the government fee, optional
 * add-ons the customer chose, the recurring renewal price, and the total due today. Nothing
 * is ever added that the customer did not select.
 */

export type ServiceLineKind = "service_fee" | "government_fee";

export interface ServiceQuoteLine {
  kind: ServiceLineKind;
  serviceCode: ServiceCode;
  /** "annual" lines become a yearly Stripe subscription price; "one_time" lines are charged once. */
  billing: "one_time" | "annual";
  description: string;
  amountCents: number;
  /** An optional extra the customer ticked (shown under "Optional add-ons"). */
  addOn: boolean;
}

export interface ServiceQuote {
  currency: "usd";
  lines: ServiceQuoteLine[];
  serviceFeeCents: number;
  governmentFeeCents: number;
  dueTodayCents: number;
  /** What renews each year, at the same published price; null when nothing recurs. */
  renewal: { amountCents: number; description: string } | null;
  /** service_prices ids used, so checkout can refuse unapproved prices in live mode. */
  priceIds: string[];
  pricesApproved: boolean;
  /** Plain-language disclosures shown before payment. */
  disclosures: string[];
}

export interface PriceInput {
  id: string;
  serviceFeeCents: number;
  approved: boolean;
}

export type { RaSituation };

export class QuoteError extends Error {}

function assertCents(n: number, what: string) {
  if (!Number.isInteger(n) || n < 0) throw new QuoteError(`Invalid ${what}`);
}

const RENEWAL_TERMS =
  "Renews every year at the same published price unless you cancel before the renewal date. Cancelling stops future renewals; it does not change the state's record by itself.";

/** Registered agent service alone, or as part of a switch from another agent. */
export function registeredAgentQuote(input: {
  stateName: string;
  situation: RaSituation;
  agentPrice: PriceInput;
  /** Required for "switching": the change filing's service price ($0 during the promotion). */
  changePrice?: PriceInput;
  /** Required for "switching": the state's verified change-of-agent fee. */
  changeGovernmentFeeCents?: number | null;
}): ServiceQuote {
  assertCents(input.agentPrice.serviceFeeCents, "registered agent price");
  const lines: ServiceQuoteLine[] = [
    {
      kind: "service_fee",
      serviceCode: "registered_agent",
      billing: "annual",
      description: `Filewell registered agent service in ${input.stateName}, first year`,
      amountCents: input.agentPrice.serviceFeeCents,
      addOn: false,
    },
  ];
  const prices = [input.agentPrice];
  if (input.situation === "switching") {
    if (!input.changePrice) throw new QuoteError("Missing the change filing price");
    if (input.changeGovernmentFeeCents === null || input.changeGovernmentFeeCents === undefined) {
      throw new QuoteError(`The ${input.stateName} change fee is not verified`);
    }
    assertCents(input.changePrice.serviceFeeCents, "change filing price");
    assertCents(input.changeGovernmentFeeCents, "change fee");
    lines.push({
      kind: "service_fee",
      serviceCode: "change_registered_agent",
      billing: "one_time",
      description:
        input.changePrice.serviceFeeCents === 0
          ? "Filing the change of registered agent: included"
          : "Filing the change of registered agent",
      amountCents: input.changePrice.serviceFeeCents,
      addOn: false,
    });
    lines.push({
      kind: "government_fee",
      serviceCode: "change_registered_agent",
      billing: "one_time",
      description: `${input.stateName} change of registered agent fee, paid to the state`,
      amountCents: input.changeGovernmentFeeCents,
      addOn: false,
    });
    prices.push(input.changePrice);
  }
  return finish(lines, prices, {
    renewal: { amountCents: input.agentPrice.serviceFeeCents, description: `Registered agent service in ${input.stateName}, per year` },
    disclosures: [RENEWAL_TERMS],
  });
}

/**
 * Registered agent + annual report bundle. The annual report's state fee is NOT charged
 * today: it is charged when the customer authorizes that reporting year's filing.
 */
export function bundleQuote(input: {
  stateName: string;
  situation: RaSituation;
  bundlePrice: PriceInput;
  changePrice?: PriceInput;
  changeGovernmentFeeCents?: number | null;
  includedReportingYear: number | null;
  annualReportStateFeeCents: number;
  /** Open reports already past due when the bundle starts: not covered, said plainly. */
  notCoveredReportingYears?: number[];
}): ServiceQuote {
  assertCents(input.bundlePrice.serviceFeeCents, "bundle price");
  assertCents(input.annualReportStateFeeCents, "annual report state fee");
  if (input.includedReportingYear === null) {
    throw new QuoteError("No annual report falls due in the first bundle year, so the bundle can't be sold for this business right now.");
  }
  const base = registeredAgentQuote({
    stateName: input.stateName,
    situation: input.situation,
    agentPrice: input.bundlePrice,
    changePrice: input.changePrice,
    changeGovernmentFeeCents: input.changeGovernmentFeeCents,
  });
  const lines = base.lines.map((l) =>
    l.serviceCode === "registered_agent"
      ? {
          ...l,
          serviceCode: "ra_annual_report_bundle" as const,
          description: `Filewell registered agent + ${input.includedReportingYear} annual report filing in ${input.stateName}, first year`,
        }
      : l,
  );
  const prices = input.situation === "switching" && input.changePrice ? [input.bundlePrice, input.changePrice] : [input.bundlePrice];
  return finish(lines, prices, {
    renewal: {
      amountCents: input.bundlePrice.serviceFeeCents,
      description: `Registered agent + one annual report filing in ${input.stateName}, per year`,
    },
    disclosures: [
      RENEWAL_TERMS,
      `Includes Filewell's service for the ${input.includedReportingYear} annual report. The state's annual report fee (currently ${dollars(input.annualReportStateFeeCents)}) is not charged today: we ask you to review and authorize the filing first, and charge the state fee then.`,
      ...notCoveredDisclosure(input.notCoveredReportingYears ?? []),
    ],
  });
}

function notCoveredDisclosure(years: number[]): string[] {
  if (years.length === 0) return [];
  const list = years.length === 1 ? `The ${years[0]} annual report` : `The ${years.slice(0, -1).join(", ")} and ${years[years.length - 1]} annual reports`;
  return [`${list} ${years.length === 1 ? "is" : "are"} past due and not part of this plan. File ${years.length === 1 ? "it" : "them"} separately, with us or with the state.`];
}

/** Business formation, with registered agent service only if the customer chose it. */
export function formationQuote(input: {
  stateName: string;
  formationPrice: PriceInput;
  formationGovernmentFeeCents: number | null;
  /** Present only when the customer ticked the add-on. */
  registeredAgentAddOn?: PriceInput | null;
}): ServiceQuote {
  assertCents(input.formationPrice.serviceFeeCents, "formation price");
  if (input.formationGovernmentFeeCents === null) throw new QuoteError(`The ${input.stateName} formation fee is not verified`);
  assertCents(input.formationGovernmentFeeCents, "formation fee");
  const lines: ServiceQuoteLine[] = [
    {
      kind: "service_fee",
      serviceCode: "formation",
      billing: "one_time",
      description: `Filewell business formation service in ${input.stateName}`,
      amountCents: input.formationPrice.serviceFeeCents,
      addOn: false,
    },
    {
      kind: "government_fee",
      serviceCode: "formation",
      billing: "one_time",
      description: `${input.stateName} formation filing fee, paid to the state`,
      amountCents: input.formationGovernmentFeeCents,
      addOn: false,
    },
  ];
  const prices = [input.formationPrice];
  if (input.registeredAgentAddOn) {
    assertCents(input.registeredAgentAddOn.serviceFeeCents, "registered agent price");
    lines.push({
      kind: "service_fee",
      serviceCode: "registered_agent",
      billing: "annual",
      description: `Registered agent service in ${input.stateName}, first year (optional)`,
      amountCents: input.registeredAgentAddOn.serviceFeeCents,
      addOn: true,
    });
    prices.push(input.registeredAgentAddOn);
  }
  return finish(lines, prices, {
    renewal: input.registeredAgentAddOn
      ? { amountCents: input.registeredAgentAddOn.serviceFeeCents, description: `Registered agent service in ${input.stateName}, per year` }
      : null,
    disclosures: input.registeredAgentAddOn ? [RENEWAL_TERMS] : [],
  });
}

function finish(
  lines: ServiceQuoteLine[],
  prices: PriceInput[],
  extra: { renewal: ServiceQuote["renewal"]; disclosures: string[] },
): ServiceQuote {
  const serviceFeeCents = lines.filter((l) => l.kind === "service_fee").reduce((n, l) => n + l.amountCents, 0);
  const governmentFeeCents = lines.filter((l) => l.kind === "government_fee").reduce((n, l) => n + l.amountCents, 0);
  const uniquePrices = prices.filter((p, i) => prices.findIndex((q) => q.id === p.id) === i);
  return {
    currency: "usd",
    lines,
    serviceFeeCents,
    governmentFeeCents,
    dueTodayCents: serviceFeeCents + governmentFeeCents,
    renewal: extra.renewal,
    priceIds: uniquePrices.map((p) => p.id),
    pricesApproved: uniquePrices.every((p) => p.approved),
    disclosures: extra.disclosures,
  };
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
