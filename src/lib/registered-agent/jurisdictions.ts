import { JURISDICTIONS } from "@/lib/compliance/jurisdictions";
import type { EntityType, ISODate } from "@/lib/domain/types";

/**
 * Registered-agent coverage, one record per jurisdiction (50 states, DC and Puerto Rico).
 *
 * One nationwide workflow; everything that differs by jurisdiction lives here. A field is
 * a fact only when it carries an official source checked on a stated date. Anything else
 * is `null` (unknown), and a jurisdiction with an unknown field that a sale depends on is
 * never sold where real money could be taken (see ./sales.ts). Nothing here is inferred.
 *
 * Provider facts (coverage, what the provider files) come from Registered Agents Inc.'s
 * wholesale guides (revised November 2025). The wholesale Service Agreement is not signed,
 * so provider coverage is "listed in the provider's guide", never "confirmed".
 */

export interface RaSource {
  url: string;
  publisher: string;
  /** Short verbatim excerpt from the official page or form. */
  quote: string;
  checkedAt: ISODate;
}

export type ProviderCoverage =
  /** The provider's wholesale guide lists the jurisdiction; no signed agreement confirms it. */
  | "listed_in_provider_guide"
  /** Confirmed in the signed wholesale agreement (or a written provider confirmation on file). */
  | "confirmed_by_provider"
  /** Known not to be covered, or covered under a different legal model we have not checked. */
  | "not_confirmed";

export interface ChangeOfAgentFacts {
  /** The state's name for the filing and form number, as the official source states it. */
  formName: string;
  /** Government fee per entity type, in cents. A missing entity type means "not verified". */
  governmentFeeCents: Partial<Record<EntityType, number>>;
  /** Whether the state requires the new agent's consent. null = not verified. */
  newAgentConsentRequired: boolean | null;
  sources: RaSource[];
}

export interface RaJurisdiction {
  code: string;
  name: string;
  /** Slug for public pages (same as the annual-report directory where one exists). */
  slug: string;
  providerCoverage: ProviderCoverage;
  /** How a new entity names the agent (in its formation filing). null = not verified for this state. */
  appointmentProcess: string | null;
  /** Change of registered agent for an existing entity. null = not verified. */
  changeOfAgent: ChangeOfAgentFacts | null;
  /** Formation filing fee for a new entity, by entity type. null = not verified (formation not sold). */
  formation: { governmentFeeCents: Partial<Record<EntityType, number>>; sources: RaSource[] } | null;
  /** State fee charged when an agent resigns, by entity type, where verified. Informational. */
  resignationFeeCents: Partial<Record<EntityType, number>> | null;
  /** Other state-specific requirements an operator or customer must know. Facts only, sourced. */
  filingRequirements: { text: string; source: RaSource }[];
  /** Provider-side notes that affect fulfillment (from the provider's guides). */
  providerNotes: string[];
  /** Refund or cancellation considerations specific to this jurisdiction. */
  refundNotes: string[];
  /**
   * Operator readiness: true only once an operator has completed a test order path with the
   * provider for this jurisdiction (or the agreement confirms the steps). False everywhere today.
   */
  fulfillmentReady: boolean;
  /** Why this jurisdiction can't be sold yet, in plain words, for the admin console. */
  knownBlockers: string[];
}

// ---------------------------------------------------------------------------
// Verified facts (official sources, checked 2026-10-29)
// ---------------------------------------------------------------------------

const CHECKED = "2026-10-29";

const VERIFIED_CHANGE: Record<string, ChangeOfAgentFacts> = {
  TX: {
    formName: "Statement of Change of Registered Office/Agent (Form 401)",
    governmentFeeCents: { llc: 1500, corporation: 1500 },
    newAgentConsentRequired: true,
    sources: [
      {
        url: "https://www.sos.state.tx.us/corp/instructions/401.shtml",
        publisher: "Texas Secretary of State",
        quote: "The filing fee for a change of registered office/agent is $15.",
        checkedAt: CHECKED,
      },
      {
        url: "https://www.sos.state.tx.us/corp/instructions/401.shtml",
        publisher: "Texas Secretary of State",
        quote: "a person designated as the registered agent of an entity must have consented",
        checkedAt: CHECKED,
      },
    ],
  },
  FL: {
    formName: "Change of Registered Agent",
    // The LLC fee page was checked; the corporation fee was not, so corporations are not sold.
    governmentFeeCents: { llc: 2500 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://dos.fl.gov/sunbiz/forms/fees/llc-fees/",
        publisher: "Florida Department of State, Division of Corporations",
        quote: "Change of Registered Agent | $ 25.00",
        checkedAt: CHECKED,
      },
    ],
  },
  CO: {
    formName: "Statement of Change Changing the Registered Agent Information",
    governmentFeeCents: { llc: 1000, corporation: 1000 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://www.sos.state.co.us/pubs/info_center/fees/business.html",
        publisher: "Colorado Secretary of State",
        quote: "Statement of Change Changing the Registered Agent Information: $10.00 (online)",
        checkedAt: CHECKED,
      },
    ],
  },
  SD: {
    formName: "Statement of Change of Registered Agent and/or Address",
    governmentFeeCents: { llc: 1000, corporation: 1000 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://sdsos.gov/general-information/filing-fees.aspx",
        publisher: "South Dakota Secretary of State",
        quote: "Statement of Change of Registered Agent and/or Address $10",
        checkedAt: CHECKED,
      },
    ],
  },
  MI: {
    formName: "Certificate of Change of Registered Office and/or Change of Resident Agent (CSCL/CD 520)",
    governmentFeeCents: { llc: 500, corporation: 500 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/corporation/520-0725.pdf",
        publisher: "Michigan Department of Licensing and Regulatory Affairs",
        quote: "CERTIFICATE OF CHANGE OF REGISTERED OFFICE AND/OR CHANGE OF RESIDENT AGENT ... $5.00",
        checkedAt: CHECKED,
      },
    ],
  },
  MT: {
    formName: "Statement of Change of Registered Office/Agent",
    governmentFeeCents: { llc: 0, corporation: 0 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://sosmt.gov/business/fees/",
        publisher: "Montana Secretary of State",
        quote: "Statement Of Change - Registered Office/Agent/Both | NO FEE",
        checkedAt: CHECKED,
      },
    ],
  },
  PA: {
    formName: "Change of Registered Office",
    governmentFeeCents: { llc: 500, corporation: 500 },
    newAgentConsentRequired: null,
    sources: [
      {
        url: "https://www.pa.gov/agencies/dos/programs/business/fees-and-payments",
        publisher: "Pennsylvania Department of State",
        quote: "Change of Registered Office | $5",
        checkedAt: CHECKED,
      },
    ],
  },
};

const VERIFIED_RESIGNATION: Record<string, Partial<Record<EntityType, number>>> = {
  // Florida LLC fee page: "Registered Agent Resignation (active) | $ 85.00".
  FL: { llc: 8500 },
};

const EXTRA_BLOCKERS: Record<string, string[]> = {
  PA: [
    "Pennsylvania uses Commercial Registered Office Providers instead of registered agents. The provider's Pennsylvania status was not checked.",
  ],
  FL: ["Corporation change fee not verified, so only LLCs could be sold."],
  WY: ["The provider must hold beneficial ownership details for Wyoming entities (provider guide). Intake for that is not built."],
  PR: ["Puerto Rico requirements have not been researched."],
};

const PROVIDER_NOTES: Record<string, string[]> = {
  WY: ["Provider guide: the provider must hold beneficial ownership details for Wyoming entities."],
};

const REFUND_NOTES: Record<string, string[]> = {
  FL: ["Florida charges $85 to file an agent resignation for an active LLC. Who pays it on cancellation is not settled in the wholesale agreement."],
};

const COMMON_BLOCKERS = [
  "Wholesale Service Agreement with Registered Agents Inc. not signed.",
  "No operator test order completed for this jurisdiction.",
];

function blockersFor(code: string, change: ChangeOfAgentFacts | null): string[] {
  return [
    ...COMMON_BLOCKERS,
    ...(change ? [] : ["Change of registered agent filing and fee not verified from an official source."]),
    "How new entities name the agent in this jurisdiction has not been verified.",
    ...(EXTRA_BLOCKERS[code] ?? []),
  ];
}

function build(code: string, name: string, slug: string): RaJurisdiction {
  const change = VERIFIED_CHANGE[code] ?? null;
  return {
    code,
    name,
    slug,
    providerCoverage: code === "PA" ? "not_confirmed" : "listed_in_provider_guide",
    appointmentProcess: null,
    changeOfAgent: change,
    formation: null,
    resignationFeeCents: VERIFIED_RESIGNATION[code] ?? null,
    filingRequirements: [],
    providerNotes: PROVIDER_NOTES[code] ?? [],
    refundNotes: REFUND_NOTES[code] ?? [],
    fulfillmentReady: false,
    knownBlockers: blockersFor(code, change),
  };
}

/** All 52 registered-agent jurisdictions, in the annual-report directory's order, then Puerto Rico. */
export const RA_JURISDICTIONS: RaJurisdiction[] = [
  ...JURISDICTIONS.map((j) => build(j.code, j.name, j.slug)),
  build("PR", "Puerto Rico", "puerto-rico"),
];

export function getRaJurisdiction(code: string): RaJurisdiction | undefined {
  const c = code.toUpperCase();
  return RA_JURISDICTIONS.find((j) => j.code === c);
}

export function getRaJurisdictionBySlug(slug: string): RaJurisdiction | undefined {
  return RA_JURISDICTIONS.find((j) => j.slug === slug);
}

/** The government change-of-agent fee for this entity type, or null when not verified. */
export function changeOfAgentFeeCents(code: string, entityType: EntityType): number | null {
  const fee = getRaJurisdiction(code)?.changeOfAgent?.governmentFeeCents[entityType];
  return typeof fee === "number" ? fee : null;
}

/** The government formation fee for this entity type, or null when not verified. */
export function formationFeeCents(code: string, entityType: EntityType): number | null {
  const fee = getRaJurisdiction(code)?.formation?.governmentFeeCents[entityType];
  return typeof fee === "number" ? fee : null;
}

/** Jurisdictions whose public page has verified, jurisdiction-specific facts to show. */
export function raJurisdictionsWithPublicFacts(): RaJurisdiction[] {
  return RA_JURISDICTIONS.filter((j) => j.changeOfAgent !== null && j.code !== "PA");
}
