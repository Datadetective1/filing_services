import { JURISDICTIONS } from "@/lib/compliance/jurisdictions";
import type { EntityType, ISODate } from "@/lib/domain/types";
import { STATE_FACTS } from "./jurisdiction-facts";

/**
 * Registered-agent coverage, one record per jurisdiction (50 states, DC and Puerto Rico).
 *
 * One nationwide workflow; everything that differs by jurisdiction lives here. A field is
 * a fact only when it carries an official source checked on a stated date (the data is in
 * ./jurisdiction-facts.ts). Anything else is `null` (unknown), and a jurisdiction with an
 * unknown field that a sale depends on is never sold where real money could be taken (see
 * ./sales.ts). Nothing here is inferred.
 *
 * Provider coverage comes from Registered Agents Inc.'s own state pages (checked on the date
 * stored with each source) and its wholesale guides (revised November 2025). The wholesale
 * Service Agreement is not signed, so coverage is "listed by the provider", never "confirmed".
 */

export interface RaSource {
  url: string;
  publisher: string;
  /** Short verbatim excerpt from the official page or form. */
  quote: string;
  checkedAt: ISODate;
}

export type ProviderCoverage =
  /** The provider's own website has a page offering registered agent service here. */
  | "listed_on_provider_site"
  /** The provider's wholesale guide lists the jurisdiction. */
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

/** Customer details a jurisdiction (or the provider for it) needs beyond the usual contact. */
export interface ExtraIntake {
  /** Names and addresses of the people who own or control the business. */
  beneficialOwners: boolean;
}

export interface RaJurisdiction {
  code: string;
  name: string;
  /** Slug for public pages (same as the annual-report directory where one exists). */
  slug: string;
  providerCoverage: ProviderCoverage;
  /** The provider's own page for this jurisdiction, when one was found. */
  providerSource: RaSource | null;
  /** How a new entity names the agent (in its formation filing). null = not verified for this state. */
  appointmentProcess: string | null;
  appointmentSources: RaSource[];
  /** Change of registered agent for an existing entity. null = not verified. */
  changeOfAgent: ChangeOfAgentFacts | null;
  /** Formation filing fee for a new entity, by entity type. null = not verified (formation not sold). */
  formation: {
    governmentFeeCents: Partial<Record<EntityType, number>>;
    sources: RaSource[];
  } | null;
  /** State fee charged when an agent resigns, by entity type, where verified. Informational. */
  resignationFeeCents: Partial<Record<EntityType, number>> | null;
  /** Operator notes from the official sources (online versus paper fees, consent forms). */
  researchNotes: string[];
  /** What could not be verified, in plain words. */
  unverified: string[];
  /** Provider-side notes that affect fulfillment (from the provider's guides). */
  providerNotes: string[];
  /** Refund or cancellation considerations specific to this jurisdiction. */
  refundNotes: string[];
  /** Extra customer details collected before payment for this jurisdiction. */
  extraIntake: ExtraIntake;
  /**
   * Operator readiness for this jurisdiction alone. The workflow is the same everywhere, so one
   * end-to-end provider test (RA_FULFILLMENT_TESTED) covers every jurisdiction; this flag is
   * only for a jurisdiction that needed its own test.
   */
  fulfillmentReady: boolean;
  /** Why this jurisdiction can't be sold yet beyond the nationwide gates, in plain words. */
  knownBlockers: string[];
  /** Why formation can't be sold here yet even with a verified fee (a publication requirement, an extra tax). */
  formationBlockers: string[];
}

const VERIFIED_RESIGNATION: Record<
  string,
  Partial<Record<EntityType, number>>
> = {
  // Florida LLC fee page: "Registered Agent Resignation (active) | $ 85.00".
  FL: { llc: 8500 },
};

const PROVIDER_NOTES: Record<string, string[]> = {
  WY: [
    "Provider guide: the provider must hold beneficial ownership details for Wyoming entities. Collected at checkout.",
  ],
};

const EXTRA_INTAKE: Record<string, Partial<ExtraIntake>> = {
  WY: { beneficialOwners: true },
};

const REFUND_NOTES: Record<string, string[]> = {
  FL: [
    "Florida charges $85 to file an agent resignation for an active LLC. Who pays it on cancellation is not settled in the wholesale agreement.",
  ],
};

/** Blockers that come from a missing fact for one entity type or path (the rest are jurisdiction-wide). */
export const FACT_GAP =
  /fee not verified|filing and fee not verified|name the agent in this jurisdiction/;

function build(code: string, name: string, slug: string): RaJurisdiction {
  const f = STATE_FACTS[code];
  const change = f?.change ?? null;
  const blockers: string[] = [];
  if (!f) blockers.push("This jurisdiction has not been researched.");
  if (!change)
    blockers.push(
      "Change of registered agent filing and fee not verified from an official source.",
    );
  else {
    if (change.governmentFeeCents.llc === undefined)
      blockers.push("LLC change of agent fee not verified.");
    if (change.governmentFeeCents.corporation === undefined)
      blockers.push("Corporation change of agent fee not verified.");
  }
  if (!f?.appointment)
    blockers.push(
      "How new entities name the agent in this jurisdiction has not been verified.",
    );
  blockers.push(...(f?.stateBlockers ?? []));
  return {
    code,
    name,
    slug,
    providerCoverage:
      f?.providerCoverage ??
      (f?.provider ? "listed_on_provider_site" : "listed_in_provider_guide"),
    providerSource: f?.provider ?? null,
    appointmentProcess: f?.appointment?.text ?? null,
    appointmentSources: f?.appointment?.sources ?? [],
    changeOfAgent: change,
    formation: f?.formation ?? null,
    resignationFeeCents: VERIFIED_RESIGNATION[code] ?? null,
    researchNotes: f?.notes ?? [],
    unverified: f?.unverified ?? [],
    providerNotes: PROVIDER_NOTES[code] ?? [],
    refundNotes: REFUND_NOTES[code] ?? [],
    extraIntake: { beneficialOwners: false, ...EXTRA_INTAKE[code] },
    fulfillmentReady: false,
    knownBlockers: blockers,
    formationBlockers: f?.formationBlockers ?? [],
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

export function getRaJurisdictionBySlug(
  slug: string,
): RaJurisdiction | undefined {
  return RA_JURISDICTIONS.find((j) => j.slug === slug);
}

/** The government change-of-agent fee for this entity type, or null when not verified. */
export function changeOfAgentFeeCents(
  code: string,
  entityType: EntityType,
): number | null {
  const fee =
    getRaJurisdiction(code)?.changeOfAgent?.governmentFeeCents[entityType];
  return typeof fee === "number" ? fee : null;
}

/** The government formation fee for this entity type, or null when not verified. */
export function formationFeeCents(
  code: string,
  entityType: EntityType,
): number | null {
  const fee =
    getRaJurisdiction(code)?.formation?.governmentFeeCents[entityType];
  return typeof fee === "number" ? fee : null;
}

/** Blockers that belong to the jurisdiction itself (Pennsylvania's office providers, say), not a missing fee. */
export function stateSpecificBlockers(j: RaJurisdiction): string[] {
  return j.knownBlockers.filter((b) => !FACT_GAP.test(b));
}

/**
 * Every fact a registered agent sale depends on is verified here, for both entity types and
 * both paths (switching and new businesses). Only the nationwide gates remain.
 */
export function raFactsComplete(j: RaJurisdiction): boolean {
  return j.providerCoverage !== "not_confirmed" && j.knownBlockers.length === 0;
}

/** Jurisdictions whose public page has verified, jurisdiction-specific facts to show. */
export function raJurisdictionsWithPublicFacts(): RaJurisdiction[] {
  return RA_JURISDICTIONS.filter(
    (j) =>
      j.changeOfAgent?.governmentFeeCents.llc !== undefined &&
      j.providerCoverage !== "not_confirmed" &&
      stateSpecificBlockers(j).length === 0,
  );
}
