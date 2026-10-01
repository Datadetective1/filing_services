import "server-only";
import {
  normalizeSearchQuery,
  PA_OPEN_DATA,
  type PaOpenDataRow,
  type RegistryDetail,
  type RegistryHit,
  soqlPrefix,
  soqlString,
  toDetail,
  toHit,
} from "./pa-open-data-map";

/**
 * Pennsylvania business-register lookup through the Department of State's official open
 * dataset on data.pa.gov (Socrata). This is the supported, public-domain machine source;
 * file.dos.pa.gov sits behind a bot challenge and is never automated.
 *
 * Polite by construction: server-side only, one request per search, 6 s timeout, results
 * cached in memory for 10 minutes, callers rate-limit per visitor. SOCRATA_APP_TOKEN
 * (free, optional) raises Socrata's shared throttling limits.
 */

export class RegistryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryUnavailableError";
  }
}

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function remember<T>(key: string, value: T): T {
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function query(dataset: string, params: Record<string, string>): Promise<PaOpenDataRow[]> {
  const url = new URL(`${PA_OPEN_DATA.host}/resource/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "Filewell (support@getfilewell.com)" };
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  if (token) headers["X-App-Token"] = token;
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" });
  } catch {
    throw new RegistryUnavailableError("Pennsylvania's business register didn't respond.");
  }
  if (!res.ok) throw new RegistryUnavailableError(`Pennsylvania's business register returned ${res.status}.`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as PaOpenDataRow[]) : [];
}

/** Up to 15 matching businesses, by name prefix (then full text) or entity number. */
export async function searchPaRegister(q: string): Promise<RegistryHit[]> {
  const nq = normalizeSearchQuery(q);
  if (!nq) return [];
  const key = `search:${nq.kind}:${nq.value}`;
  const hit = cached<RegistryHit[]>(key);
  if (hit) return hit;

  const select = "business_name, filing_number, typeofbusinessregistration, city, state, shortcountyname";
  let rows: PaOpenDataRow[];
  if (nq.kind === "number") {
    rows = await query(PA_OPEN_DATA.searchDataset, { $select: select, $where: `filing_number = ${soqlString(nq.value)}`, $limit: "15" });
  } else {
    rows = await query(PA_OPEN_DATA.searchDataset, {
      $select: select,
      $where: `upper(business_name) like ${soqlPrefix(nq.value)}`,
      $order: "business_name",
      $limit: "15",
    });
    if (rows.length === 0) rows = await query(PA_OPEN_DATA.searchDataset, { $select: select, $q: nq.value, $limit: "15" });
  }
  const hits = rows.map(toHit).filter((h): h is RegistryHit => h !== null);
  const unique = [...new Map(hits.map((h) => [h.entityNumber, h])).values()];
  return remember(key, unique);
}

/** Full record (people, address) for one entity number, or null when the dataset has none. */
export async function getPaRecord(entityNumber: string): Promise<RegistryDetail | null> {
  const nq = normalizeSearchQuery(entityNumber);
  if (!nq || nq.kind !== "number") return null;
  const key = `detail:${nq.value}`;
  const hit = cached<RegistryDetail | null>(key);
  if (hit !== undefined) return hit;
  const rows = await query(PA_OPEN_DATA.detailDataset, { $where: `filing_number = ${soqlString(nq.value)}`, $limit: "200" });
  return remember(key, toDetail(rows));
}
