import "server-only";
import { getPaRecord, RegistryUnavailableError, searchPaRegister } from "./pa-open-data";
import type { RegistryDetail, RegistryHit } from "./pa-open-data-map";
import { soqlPrefix, soqlString } from "./pa-open-data-map";
import { parseStateQuery, type Row, type StateDataset, stateDataset, toStateDetail, uniqueHits } from "./state-open-data-map";

/**
 * Live search of each state's official open business dataset (Socrata). Same rules as the
 * Pennsylvania module: server-side only, one or two requests per search, a short timeout,
 * results cached in memory for 10 minutes, and callers rate-limit per visitor.
 */

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

async function query(ds: StateDataset, params: Record<string, string>): Promise<Row[]> {
  const url = new URL(`${ds.host}/resource/${ds.dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "Filewell (support@getfilewell.com)" };
  const token = process.env.SOCRATA_APP_TOKEN?.trim();
  if (token) headers["X-App-Token"] = token;
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new RegistryUnavailableError(`The ${ds.code} business register didn't respond.`);
  }
  if (!res.ok) throw new RegistryUnavailableError(`The ${ds.code} business register returned ${res.status}.`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as Row[]) : [];
}

function and(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).map((p) => `(${p})`).join(" AND ");
}

async function searchDataset(ds: StateDataset, q: string): Promise<RegistryHit[]> {
  const nq = parseStateQuery(ds, q);
  if (!nq) return [];
  const key = `${ds.code}:search:${nq.kind}:${nq.value}`;
  const hit = cached<RegistryHit[]>(key);
  if (hit) return hit;

  const $select = ds.select.join(", ");
  // Oregon has a row per name or address, so ask for more rows and dedupe here.
  const $limit = ds.code === "OR" ? "60" : "20";
  let rows: Row[];
  if (nq.kind === "number") {
    rows = await query(ds, { $select, $where: and(`${ds.numberField} = ${soqlString(nq.value)}`, ds.where), $limit });
  } else {
    const field = ds.upperCaseNames ? ds.nameField : `upper(${ds.nameField})`;
    rows = await query(ds, { $select, $where: and(`${field} like ${soqlPrefix(nq.value)}`, ds.where), $order: ds.nameField, $limit });
    if (rows.length === 0) rows = await query(ds, { $select, $q: nq.value, ...(ds.where ? { $where: ds.where } : {}), $limit });
  }
  return remember(key, uniqueHits(ds, rows));
}

async function recordFromDataset(ds: StateDataset, entityNumber: string): Promise<RegistryDetail | null> {
  const nq = parseStateQuery(ds, entityNumber);
  if (!nq || nq.kind !== "number") return null;
  const key = `${ds.code}:detail:${nq.value}`;
  const hit = cached<RegistryDetail | null>(key);
  if (hit !== undefined) return hit;
  const rows = await query(ds, { $select: ds.select.join(", "), $where: and(`${ds.numberField} = ${soqlString(nq.value)}`, ds.where), $limit: "20" });
  return remember(key, toStateDetail(ds, rows));
}

/** Up to 15 businesses on the state's register by name prefix (then full text) or number. */
export async function searchStateRegister(stateCode: string, q: string): Promise<RegistryHit[]> {
  if (stateCode === "PA") return searchPaRegister(q);
  const ds = stateDataset(stateCode);
  return ds ? searchDataset(ds, q) : [];
}

/** One record, re-read on the server, or null when the dataset has none. */
export async function getStateRecord(stateCode: string, entityNumber: string): Promise<RegistryDetail | null> {
  if (stateCode === "PA") return getPaRecord(entityNumber);
  const ds = stateDataset(stateCode);
  return ds ? recordFromDataset(ds, entityNumber) : null;
}

export { RegistryUnavailableError };
