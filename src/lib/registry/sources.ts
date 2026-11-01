/**
 * Which states' business registers a visitor can search on Filewell, and how each one is
 * described to them. Client-safe (no network code). Every source here is a free, official
 * open dataset that the state publishes for public reuse, queried live and never stored.
 *
 * Checked 2026-11-01 on each state's own open data portal. States left out publish no free
 * machine-readable register (for example Florida, Delaware, California, Michigan), only
 * offer a bulk download (Iowa), or block automated access (Ohio).
 */

export interface RegistrySourceInfo {
  code: string;
  name: string;
  /** Shown under the search and on the result page. Never a status claim. */
  source: string;
  /** What the state calls its entity number, in the visitor's words. */
  numberLabel: string;
  /** Short reminder of what the source can't tell, shown under the search. */
  caveat: string;
}

const REGISTRY_SOURCES: Record<string, RegistrySourceInfo> = {
  PA: {
    code: "PA",
    name: "Pennsylvania",
    source: "Pennsylvania Department of State business register, published on data.pa.gov and updated monthly",
    numberLabel: "entity number",
    caveat: "It doesn't show standing or filing history.",
  },
  CO: {
    code: "CO",
    name: "Colorado",
    source: "Colorado Secretary of State business records, published on data.colorado.gov and updated daily",
    numberLabel: "ID number",
    caveat: "It doesn't show standing or filing history.",
  },
  CT: {
    code: "CT",
    name: "Connecticut",
    source: "Connecticut Secretary of the State business registry, published on data.ct.gov and updated daily",
    numberLabel: "business ID",
    caveat: "It doesn't show standing or filing history.",
  },
  NY: {
    code: "NY",
    name: "New York",
    source: "New York Department of State corporation and LLC records, published on data.ny.gov",
    numberLabel: "DOS ID",
    caveat: "It doesn't show standing or filing history, and very new filings may not be listed yet.",
  },
  OR: {
    code: "OR",
    name: "Oregon",
    source: "Oregon Secretary of State business registry, published on data.oregon.gov",
    numberLabel: "registry number",
    caveat: "It doesn't show standing or filing history.",
  },
  TX: {
    code: "TX",
    name: "Texas",
    source: "Texas Comptroller franchise tax records, published on data.texas.gov",
    numberLabel: "SOS file number",
    caveat: "It comes from the Comptroller, not the Secretary of State, and doesn't show standing or filing history.",
  },
};

export function registrySource(code: string | null | undefined): RegistrySourceInfo | null {
  return (code && REGISTRY_SOURCES[code.toUpperCase()]) || null;
}

export function hasRegistrySearch(code: string | null | undefined): boolean {
  return registrySource(code) !== null;
}

export function registryStates(): RegistrySourceInfo[] {
  return Object.values(REGISTRY_SOURCES).sort((a, b) => a.name.localeCompare(b.name));
}
