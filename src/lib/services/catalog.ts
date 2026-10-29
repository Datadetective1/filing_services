/**
 * Business services catalog: what Filewell sells beyond the annual report, what each
 * costs us, and whether it may be sold at all.
 *
 * Retail prices here are the founder-approved LAUNCH/TEST prices (Oct 29, 2026). They are
 * defaults for seeding `service_prices`; the database row is what checkout charges, and live
 * checkout refuses any row an admin has not approved in /admin/pricing. Changing a price is
 * a data change, never a code change.
 *
 * Wholesale costs are Registered Agents Inc.'s proposed wholesale rates. The wholesale
 * Service Agreement is not signed yet; update `WHOLESALE` when it is.
 */

export const SERVICE_CODES = [
  "annual_report",
  "registered_agent",
  "ra_annual_report_bundle",
  "formation",
  "change_registered_agent",
  "additional_mail",
  "amendment",
  "good_standing_certificate",
  "reinstatement",
  "ein_assistance",
] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

export function isServiceCode(v: unknown): v is ServiceCode {
  return typeof v === "string" && (SERVICE_CODES as readonly string[]).includes(v);
}

export type Billing = "one_time" | "annual" | "per_item";
export type FulfillmentMethod = "internal_manual" | "registered_agents_inc" | "other_provider";

export const FULFILLMENT_METHOD_LABELS: Record<FulfillmentMethod, string> = {
  internal_manual: "Internal (manual)",
  registered_agents_inc: "Registered Agents Inc.",
  other_provider: "Other provider",
};

/**
 * Registered Agents Inc. proposed wholesale rates, in cents, excluding state fees.
 * EIN prices are flat (no state fee).
 */
export const WHOLESALE = {
  registeredAgentPerYear: 4500,
  formation: 7500,
  changeOfAgent: 2500,
  annualReport: 7500,
  amendment: 7500,
  goodStanding: 5000,
  einWithSsn: 2500,
  einWithoutSsn: 10000,
  /** Regular (non-legal) mail beyond the provider's included items, per item viewed. */
  additionalMailItem: 1500,
} as const;

/** The provider's name as it must be disclosed (its name and address appear on state records). */
export const PROVIDER_LEGAL_NAME = "Registered Agents Inc.";

export type LaunchStatus =
  /** Built and configurable; sales stay off until every gate in docs/REGISTERED_AGENT.md passes. */
  | "built_not_launched"
  /** Already sold in production (annual report at its existing price). */
  | "live"
  /** Not built: margin or requirements are uncertain, flagged instead of activated. */
  | "not_offered";

export interface ServiceDef {
  code: ServiceCode;
  name: string;
  /** filing_types.code whose service_prices row holds the retail price. */
  filingTypeCode: string;
  billing: Billing;
  /** Proposed retail service charge (excluding government fees), in cents. */
  proposedServiceFeeCents: number | null;
  /** Our cost per unit when fulfilled by Registered Agents Inc., in cents (excluding state fees). */
  wholesaleCents: number | null;
  /** Whether a state/government fee is passed through on top. */
  governmentFee: "pass_through" | "none";
  launchStatus: LaunchStatus;
  /** Plain-language note for the admin console (why not offered, what is pending). */
  note: string;
}

export const SERVICES: Record<ServiceCode, ServiceDef> = {
  annual_report: {
    code: "annual_report",
    name: "Annual report filing",
    filingTypeCode: "annual_report",
    billing: "one_time",
    // Production keeps its existing price ($49 per state) until a rollout is approved; the
    // $79 proposal is a separate, unapproved price variant (see ANNUAL_REPORT_PROPOSED_FEE_CENTS).
    proposedServiceFeeCents: 4900,
    wholesaleCents: WHOLESALE.annualReport,
    governmentFee: "pass_through",
    launchStatus: "live",
    note: "Self-fulfilled today in PA, CO, FL, SD, MT and MI. The provider charges $75 plus the state fee if we ever send one to them.",
  },
  registered_agent: {
    code: "registered_agent",
    name: "Registered agent service",
    filingTypeCode: "registered_agent",
    billing: "annual",
    proposedServiceFeeCents: 11900,
    wholesaleCents: WHOLESALE.registeredAgentPerYear,
    governmentFee: "none",
    launchStatus: "built_not_launched",
    note: "Same price at purchase and renewal. Per entity, per state, per year.",
  },
  ra_annual_report_bundle: {
    code: "ra_annual_report_bundle",
    name: "Registered agent + annual report",
    filingTypeCode: "ra_annual_report_bundle",
    billing: "annual",
    proposedServiceFeeCents: 16900,
    wholesaleCents: WHOLESALE.registeredAgentPerYear,
    governmentFee: "pass_through",
    launchStatus: "built_not_launched",
    note: "Only where Filewell files the annual report itself and registered agent sales are open. The annual report's state fee is charged when the customer authorizes that year's filing.",
  },
  formation: {
    code: "formation",
    name: "Business formation",
    filingTypeCode: "formation",
    billing: "one_time",
    proposedServiceFeeCents: 9900,
    wholesaleCents: WHOLESALE.formation,
    governmentFee: "pass_through",
    launchStatus: "built_not_launched",
    note: "Registered agent service is a separate, optional add-on. Sold only where the state's formation fee is verified and nothing else is owed at formation.",
  },
  change_registered_agent: {
    code: "change_registered_agent",
    name: "Switch registered agent",
    filingTypeCode: "change_registered_agent",
    billing: "one_time",
    // Launch promotion: the customer pays only the state fee; Filewell absorbs the provider's
    // $25 filing charge as an acquisition cost. Requires the annual registered agent service.
    proposedServiceFeeCents: 0,
    wholesaleCents: WHOLESALE.changeOfAgent,
    governmentFee: "pass_through",
    launchStatus: "built_not_launched",
    note: "Sold only with registered agent service. Service fee $0 while the acquisition promotion runs; the $25 provider charge is tracked as an acquisition cost.",
  },
  additional_mail: {
    code: "additional_mail",
    name: "Additional regular mail item",
    filingTypeCode: "additional_mail",
    billing: "per_item",
    proposedServiceFeeCents: 1500,
    wholesaleCents: WHOLESALE.additionalMailItem,
    governmentFee: "none",
    launchStatus: "built_not_launched",
    note: "Pass-through at cost, subject to the final agreement. Never applies to service of process or government notices.",
  },
  amendment: {
    code: "amendment",
    name: "Amendment",
    filingTypeCode: "amendment",
    billing: "one_time",
    proposedServiceFeeCents: null,
    wholesaleCents: WHOLESALE.amendment,
    governmentFee: "pass_through",
    launchStatus: "not_offered",
    note: "Not priced. Needs competitor research and per-state fees before a margin can be judged.",
  },
  good_standing_certificate: {
    code: "good_standing_certificate",
    name: "Certificate of good standing",
    filingTypeCode: "good_standing_certificate",
    billing: "one_time",
    proposedServiceFeeCents: null,
    wholesaleCents: WHOLESALE.goodStanding,
    governmentFee: "pass_through",
    launchStatus: "not_offered",
    note: "Not priced. Many states issue these online for a small fee, so customer value at a $50 wholesale cost is uncertain.",
  },
  reinstatement: {
    code: "reinstatement",
    name: "Reinstatement",
    filingTypeCode: "reinstatement",
    billing: "one_time",
    proposedServiceFeeCents: null,
    wholesaleCents: WHOLESALE.amendment,
    governmentFee: "pass_through",
    launchStatus: "not_offered",
    note: "Not priced. State fees and requirements vary widely and are unverified.",
  },
  ein_assistance: {
    code: "ein_assistance",
    name: "EIN assistance",
    filingTypeCode: "ein_assistance",
    billing: "one_time",
    proposedServiceFeeCents: null,
    wholesaleCents: WHOLESALE.einWithSsn,
    governmentFee: "none",
    launchStatus: "not_offered",
    note: "Not priced. The IRS issues EINs free online; $25 (with SSN) or $100 (without) wholesale. Customer value must be checked before offering.",
  },
};

/** Proposed annual report price for new customers (not approved; production stays at $49). */
export const ANNUAL_REPORT_PROPOSED_FEE_CENTS = 7900;
/** Name of the unapproved annual report price variant that carries the $79 proposal. */
export const ANNUAL_REPORT_PROPOSED_VARIANT = "proposed_79";
export const STANDARD_PRICE_VARIANT = "standard";

/** What the bundle saves against buying both services separately at proposed prices. */
export function bundleSavingsCents(): number {
  return (
    (SERVICES.registered_agent.proposedServiceFeeCents ?? 0) +
    ANNUAL_REPORT_PROPOSED_FEE_CENTS -
    (SERVICES.ra_annual_report_bundle.proposedServiceFeeCents ?? 0)
  );
}

/** Services a customer can see offered next to this one (relevant only, never auto-added). */
export const CROSS_SELL: Partial<Record<ServiceCode, ServiceCode[]>> = {
  annual_report: ["registered_agent"],
  registered_agent: ["annual_report"],
  formation: ["registered_agent"],
  change_registered_agent: ["annual_report"],
};
