import "server-only";
import { publicQuote } from "@/lib/compliance/public-quote";
import { isRuleSellable, rulesForState } from "@/lib/compliance/registry";
import { stateSalesEnabled } from "@/lib/compliance/launch";
import { ENTITY_TYPE_LABELS, type EntityType } from "@/lib/domain/types";
import { changeOfAgentFeeCents, formationFeeCents, getRaJurisdiction, getRaJurisdictionBySlug, RA_JURISDICTIONS } from "@/lib/registered-agent/jurisdictions";
import { providerReportOpenState } from "@/lib/registered-agent/provider-report";
import { BUNDLE_STATES, bundleSalesOpen, businessServicesPagesEnabled, formationSaleCheck, raSaleCheck } from "@/lib/registered-agent/sales";
import { sortByDue } from "@/lib/seo/content";
import type { ServiceCode } from "./catalog";
import { publicServicePrices } from "./public-prices";

/**
 * Everything Filewell sells in one state, for the "pick your state first" pages. Read from the
 * same switches, verified state fees and approved prices checkout uses, so a service shows up
 * here only where checkout would take the order. A service that isn't open in the state is
 * listed as not offered, never priced or implied.
 */

export type StateServiceKey = "formation" | "registered_agent" | "bundle" | "annual_report";

export interface StateServiceOption {
  /** "LLC", "Corporation", "Every year". */
  label: string;
  /** What the customer pays for this option, state fee included where it is known. */
  totalCents: number;
  /** Our part of the total. */
  serviceCents: number;
  /** The state's part. Null when it depends on the business (the bundle's report fee). */
  stateCents: number | null;
  /** Where the order starts. */
  href: string;
}

export interface StateServiceOffer {
  key: StateServiceKey;
  title: string;
  /** One short line on what it is. */
  blurb: string;
  /** "once", "a year", "a year + state fee". */
  cadence: string;
  options: StateServiceOption[];
  /** One extra line, such as an entity type that isn't offered here. */
  note?: string;
}

export interface StateServiceGap {
  key: StateServiceKey;
  title: string;
  note: string;
}

export interface StateServicesView {
  code: string;
  name: string;
  slug: string;
  offered: StateServiceOffer[];
  notOffered: StateServiceGap[];
}

/** Every place a customer can pick, A to Z: the 50 states, DC and Puerto Rico. */
export function pickableStates(): { code: string; name: string; slug: string }[] {
  return RA_JURISDICTIONS.map((j) => ({ code: j.code, name: j.name, slug: j.slug })).sort((a, b) => a.name.localeCompare(b.name));
}

export function pickableStateBySlug(slug: string) {
  const j = getRaJurisdictionBySlug(slug);
  return j ? { code: j.code, name: j.name, slug: j.slug } : null;
}

export function pickableStateByCode(code: string) {
  const j = getRaJurisdiction(code);
  return j ? { code: j.code, name: j.name, slug: j.slug } : null;
}

const TYPES = ["llc", "corporation"] as const;
const TYPE_LABEL: Record<(typeof TYPES)[number], string> = { llc: "LLC", corporation: "Corporation" };
const PLURAL: Record<(typeof TYPES)[number], string> = { llc: "LLCs", corporation: "corporations" };

/** "We can't form corporations in Tennessee yet." when only one of the two types is open. */
function missingTypeNote(open: string[], sentence: (plural: string) => string): string | undefined {
  if (open.length !== 1) return undefined;
  const missing = TYPES.find((t) => !open.includes(t));
  return missing ? sentence(PLURAL[missing]) : undefined;
}

type Prices = Partial<Record<ServiceCode, number>>;

function formationOffer(code: string, name: string, prices: Prices): StateServiceOffer | null {
  const fee = prices.formation;
  if (fee === undefined) return null;
  const options: StateServiceOption[] = [];
  for (const t of TYPES) {
    const stateFee = formationFeeCents(code, t);
    if (stateFee === null || !formationSaleCheck(code, t).ok) continue;
    options.push({
      label: TYPE_LABEL[t],
      totalCents: fee + stateFee,
      serviceCents: fee,
      stateCents: stateFee,
      href: `/dashboard/services/formation?state=${code}&type=${t}`,
    });
  }
  if (options.length === 0) return null;
  return {
    key: "formation",
    title: "Start a business",
    blurb: `We form your ${name} LLC or corporation and send you the state's approval.`,
    cadence: "once, state fee included",
    options,
    note: missingTypeNote(
      options.map((o) => (o.label === "LLC" ? "llc" : "corporation")),
      (plural) => `We can't form ${plural} in ${name} yet.`,
    ),
  };
}

function raAvailable(code: string): boolean {
  return TYPES.some((t) => raSaleCheck(code, t, "new_entity").ok || raSaleCheck(code, t, "switching").ok);
}

function changeNote(code: string, name: string, prices: Prices): string | undefined {
  const switching = TYPES.filter((t) => raSaleCheck(code, t, "switching").ok);
  if (switching.length === 0) return undefined;
  const fees = switching.map((t) => changeOfAgentFeeCents(code, t)).filter((f): f is number => f !== null);
  if (fees.length === 0) return undefined;
  const ours = prices.change_registered_agent;
  if (ours === undefined) return undefined;
  const low = Math.min(...fees);
  const high = Math.max(...fees);
  const stateFee = low === high ? `the ${money(low)} state fee` : `the state fee (${money(low)} to ${money(high)})`;
  if (ours === 0) {
    return high === 0
      ? `Switching agents? We file the ${name} change for you at no extra cost.`
      : `Switching agents? We file the ${name} change for you. You pay only ${stateFee}.`;
  }
  return high === 0
    ? `Switching agents? We file the ${name} change for ${money(ours)}. The state charges nothing.`
    : `Switching agents? We file the ${name} change for ${money(ours)} plus ${stateFee}.`;
}

function money(cents: number): string {
  const d = cents / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

function registeredAgentOffer(code: string, name: string, prices: Prices): StateServiceOffer | null {
  const ra = prices.registered_agent;
  if (ra === undefined || !raAvailable(code)) return null;
  return {
    key: "registered_agent",
    title: "Registered agent",
    blurb: `A ${name} address that accepts legal papers for your business. We scan them to you.`,
    cadence: "a year, same at renewal",
    options: [{ label: "Every year", totalCents: ra, serviceCents: ra, stateCents: 0, href: `/registered-agent/start?state=${code}` }],
    note: changeNote(code, name, prices),
  };
}

function bundleOffer(code: string, name: string, prices: Prices, reportOpen: boolean): StateServiceOffer | null {
  const bundle = prices.ra_annual_report_bundle;
  if (bundle === undefined || prices.registered_agent === undefined || !bundleSalesOpen()) return null;
  if (!(BUNDLE_STATES as readonly string[]).includes(code) || !reportOpen || !raAvailable(code)) return null;
  return {
    key: "bundle",
    title: "Agent + annual report",
    blurb: `Your registered agent and your ${name} annual report, filed for you every year.`,
    cadence: "a year + the report's state fee",
    options: [{ label: "Every year", totalCents: bundle, serviceCents: bundle, stateCents: null, href: `/registered-agent/start?state=${code}` }],
  };
}

async function annualReportOffer(code: string, name: string, prices: Prices): Promise<StateServiceOffer | null> {
  // States where Filewell files the report itself: every entity type with a public quote.
  if (stateSalesEnabled(code)) {
    const options: StateServiceOption[] = [];
    const rules = sortByDue(rulesForState(code).filter((r) => r.filingTypeCode === "annual_report" && r.verificationStatus === "verified" && isRuleSellable(r)));
    // LLCs and corporations first: most customers are one of the two.
    const order = (t: EntityType) => (t === "llc" ? 0 : t === "corporation" ? 1 : 2);
    for (const r of [...rules].sort((a, b) => order(a.entityType) - order(b.entityType))) {
      if (r.appliesTo === "foreign") continue;
      const q = await publicQuote(r);
      if (!q) continue;
      if (options.some((o) => o.label === ENTITY_TYPE_LABELS[r.entityType])) continue;
      options.push({
        label: ENTITY_TYPE_LABELS[r.entityType],
        totalCents: q.totalCents,
        serviceCents: q.serviceFeeCents,
        stateCents: q.governmentFeeCents,
        href: `/find?state=${code}&entity=${r.entityType}`,
      });
    }
    if (options.length > 0) {
      return {
        key: "annual_report",
        title: "Annual report",
        blurb: "We file it, pay the state for you and send you the state's confirmation.",
        cadence: "per filing, state fee included",
        options,
      };
    }
  }
  // Everywhere else, our partner agent files it for LLCs and corporations.
  const provider = prices.provider_annual_report;
  const open = provider !== undefined ? providerReportOpenState(code) : null;
  if (provider === undefined || !open) return null;
  const options: StateServiceOption[] = [];
  for (const t of TYPES) {
    const fee = open.feeCents[t];
    if (fee === undefined) continue;
    options.push({
      label: TYPE_LABEL[t],
      totalCents: fee + provider,
      serviceCents: provider,
      stateCents: fee,
      href: `/dashboard/services/annual-report?state=${code}&type=${t}`,
    });
  }
  if (options.length === 0) return null;
  return {
    key: "annual_report",
    title: "Annual report",
    blurb: `We file your ${open.reportName.toLowerCase()} and send you the state's confirmation.`,
    cadence: "per filing, state fee included",
    options,
    note: missingTypeNote(
      options.map((o) => (o.label === "LLC" ? "llc" : "corporation")),
      (plural) => `We can't file it for ${plural} in ${name} yet.`,
    ),
  };
}

const GAP_COPY: Record<StateServiceKey, { title: string; note: (name: string) => string }> = {
  formation: { title: "Start a business", note: (n) => `Forming a new business in ${n} isn't open yet.` },
  registered_agent: { title: "Registered agent", note: (n) => `Registered agent service isn't open in ${n} yet.` },
  bundle: { title: "Agent + annual report", note: (n) => `The bundle isn't available in ${n}.` },
  annual_report: { title: "Annual report", note: (n) => `Annual report filing isn't open in ${n} yet.` },
};

/** What Filewell sells in this state right now, in the order a new customer meets them. */
export async function stateServices(code: string): Promise<StateServicesView | null> {
  const j = getRaJurisdiction(code);
  if (!j) return null;
  const prices: Prices = businessServicesPagesEnabled() ? await publicServicePrices() : {};
  const report = await annualReportOffer(j.code, j.name, prices);
  const all: [StateServiceKey, StateServiceOffer | null][] = [
    ["formation", formationOffer(j.code, j.name, prices)],
    ["registered_agent", registeredAgentOffer(j.code, j.name, prices)],
    ["bundle", bundleOffer(j.code, j.name, prices, report !== null)],
    ["annual_report", report],
  ];
  const offered = all.map(([, o]) => o).filter((o): o is StateServiceOffer => o !== null);
  // The bundle is a way to buy two services together, so its absence is never news on its own.
  const notOffered = all
    .filter(([k, o]) => o === null && k !== "bundle")
    .map(([k]) => ({ key: k, title: GAP_COPY[k].title, note: GAP_COPY[k].note(j.name) }));
  return { code: j.code, name: j.name, slug: j.slug, offered, notOffered };
}
