import "server-only";
import { publicQuote } from "@/lib/compliance/public-quote";
import { isRuleSellable, isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { providerReportOpenStates } from "@/lib/registered-agent/provider-report";
import { stateCount } from "@/lib/registered-agent/public-copy";
import { BUNDLE_STATES, bundleSalesOpen, businessServicesPagesEnabled, formationOpenStates } from "@/lib/registered-agent/sales";
import { sortByDue } from "@/lib/seo/content";
import { publicServicePrices } from "./public-prices";

/**
 * What the homepage and pricing page sell right now, read from the same switches and
 * approved prices checkout uses. Anything checkout would refuse is left out.
 */
export interface PlanOffers {
  /** Registered agent, per year. */
  raCents?: number;
  /** Agent + annual report bundle, per year, plus the state fee. */
  bundleCents?: number;
  bundleStateCount: number;
  /** Our lowest annual report fee (the self-filed states), plus the state fee. */
  reportFromCents?: number;
  /** Our fee where a partner agent files the report for us. */
  providerReportCents?: number;
  /** States where an annual report can be ordered (self-filed and partner-filed). */
  reportStateCount: number;
  /** A real all-in total to show beside "From": Pennsylvania's LLC report, state fee included. */
  reportExample?: { stateName: string; totalCents: number };
  formationCents?: number;
  /** Names of the states where formation is open, A to Z. */
  formationStates: string[];
  /** How many of the 50 states formation is open in (DC and Puerto Rico not counted). */
  formationStateCount?: number;
}

/** One state in the "what will it cost" picker. */
export interface StatePrice {
  code: string;
  name: string;
  rows: { label: string; stateCents: number; serviceCents: number; totalCents: number; href: string }[];
}

/** States where Filewell files the annual report itself (approved price and live switch). */
function selfFiledStates() {
  return listJurisdictions().filter((j) => isStateVerified(j.code) && rulesForState(j.code).some((r) => isRuleSellable(r)));
}

export async function planOffers(): Promise<PlanOffers> {
  const prices = businessServicesPagesEnabled() ? await publicServicePrices() : {};
  const raCents = prices.registered_agent;
  const bundleCents = raCents !== undefined && bundleSalesOpen() ? prices.ra_annual_report_bundle : undefined;
  const formationStates = raCents !== undefined ? formationOpenStates() : [];
  const formationCents = formationStates.length > 0 ? prices.formation : undefined;

  const self = selfFiledStates();
  let reportFromCents: number | undefined;
  for (const j of self) {
    for (const r of rulesForState(j.code).filter((x) => x.verificationStatus === "verified")) {
      const q = await publicQuote(r);
      if (q && (reportFromCents === undefined || q.serviceFeeCents < reportFromCents)) reportFromCents = q.serviceFeeCents;
    }
  }
  // Pennsylvania is where most visitors come from, so its total is the example shown.
  let reportExample: PlanOffers["reportExample"];
  const paLlc = self.some((j) => j.code === "PA") ? rulesForState("PA").find((r) => r.entityType === "llc" && isRuleSellable(r)) : undefined;
  if (paLlc) {
    const q = await publicQuote(paLlc);
    if (q) reportExample = { stateName: "Pennsylvania", totalCents: q.totalCents };
  }
  const providerReportCents = prices.provider_annual_report;
  const codes = new Set(self.map((j) => j.code));
  if (providerReportCents !== undefined) for (const s of providerReportOpenStates()) codes.add(s.code);

  return {
    raCents,
    bundleCents,
    bundleStateCount: BUNDLE_STATES.length,
    reportFromCents: reportFromCents ?? providerReportCents,
    providerReportCents,
    reportStateCount: codes.size,
    reportExample,
    formationCents,
    formationStates: formationStates.map((s) => s.name),
    formationStateCount: stateCount(formationStates.map((s) => s.code)),
  };
}

/**
 * Annual report prices by state, for the pricing page picker: every entity type we file
 * ourselves, and LLC and corporation where a partner agent files for us.
 */
export async function annualReportPrices(): Promise<StatePrice[]> {
  const out: StatePrice[] = [];
  for (const j of selfFiledStates()) {
    const rules = sortByDue(rulesForState(j.code).filter((r) => r.verificationStatus === "verified"));
    const rows: StatePrice["rows"] = [];
    for (const r of rules) {
      const q = await publicQuote(r);
      if (!q) continue;
      rows.push({
        label: ENTITY_TYPE_LABELS[r.entityType],
        stateCents: q.governmentFeeCents,
        serviceCents: q.serviceFeeCents,
        totalCents: q.totalCents,
        href: `/find?state=${j.code}&entity=${r.entityType}`,
      });
    }
    if (rows.length) out.push({ code: j.code, name: j.name, rows });
  }

  const providerCents = businessServicesPagesEnabled() ? (await publicServicePrices()).provider_annual_report : undefined;
  if (providerCents !== undefined) {
    const have = new Set(out.map((s) => s.code));
    for (const s of providerReportOpenStates()) {
      if (have.has(s.code)) continue;
      const rows: StatePrice["rows"] = [];
      for (const t of ["llc", "corporation"] as const) {
        const fee = s.feeCents[t];
        if (fee === undefined) continue;
        rows.push({
          label: t === "llc" ? "LLC" : "Corporation",
          stateCents: fee,
          serviceCents: providerCents,
          totalCents: fee + providerCents,
          href: `/dashboard/services/annual-report?state=${s.code}&type=${t}`,
        });
      }
      if (rows.length) out.push({ code: s.code, name: s.name, rows });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
