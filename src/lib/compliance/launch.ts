import { JURISDICTIONS } from "./jurisdictions";

/**
 * Independent launch controls per state (server-side env, evaluated per request/build):
 *
 *   <CODE>_LOOKUP_ENABLED       public business lookup + result page for that state
 *   <CODE>_LIVE_FILING_SALES    "Have us file it" + checkout for that state
 *
 * Pennsylvania predates these switches and stays ON unless explicitly set to "false".
 * Every other state is OFF unless explicitly set to "true". Live payment additionally
 * requires an owner-approved service price (checked at checkout), so a stray flag on
 * production still cannot take money for an unapproved state.
 */

export const LIVE_STATES = ["PA"] as const;
export const EXPANSION_STATES = ["WA", "NV", "UT"] as const;
export type LaunchState = (typeof LIVE_STATES)[number] | (typeof EXPANSION_STATES)[number];

const flag = (name: string) => process.env[name]?.trim();

export function stateLookupEnabled(code: string): boolean {
  const c = code.toUpperCase();
  if (c === "PA") return flag("PA_LOOKUP_ENABLED") !== "false";
  return (EXPANSION_STATES as readonly string[]).includes(c) && flag(`${c}_LOOKUP_ENABLED`) === "true";
}

export function stateSalesEnabled(code: string): boolean {
  const c = code.toUpperCase();
  if (c === "PA") return Boolean(JURISDICTIONS.find((j) => j.code === "PA")?.filingEnabled) && flag("PA_LIVE_FILING_SALES") !== "false";
  return (EXPANSION_STATES as readonly string[]).includes(c) && flag(`${c}_LIVE_FILING_SALES`) === "true";
}

/** States a visitor can search right now, in display order. */
export function lookupStates(): string[] {
  return [...LIVE_STATES, ...EXPANSION_STATES].filter(stateLookupEnabled);
}
