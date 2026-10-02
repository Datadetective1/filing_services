import type { EntityType } from "@/lib/domain/types";

/**
 * Pure parsing of an official state search export that an operator downloaded in a normal
 * browser (e.g. Washington CCFS Advanced Search → CSV, filtered by expiration date). No
 * network code: Filewell never automates the state sites. Header names vary between exports,
 * so columns are matched by keywords; anything unrecognized is kept in `raw`.
 */

export interface ExportRow {
  entityNumber: string;
  name: string;
  typeRaw: string;
  entityType: EntityType | null;
  isForeign: boolean | null;
  status: string | null;
  dueDate: string | null;
  formationDate: string | null;
  address: string | null;
  agent: string | null;
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ExportRow[];
  skipped: { line: number; reason: string }[];
  columns: Record<keyof Omit<ExportRow, "raw" | "entityType" | "isForeign">, string | null>;
}

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) out.push(row);
  return out;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function findColumn(headers: string[], tests: RegExp[], exclude: RegExp[] = []): number {
  const n = headers.map(norm);
  for (const t of tests) {
    const i = n.findIndex((h) => t.test(h) && !exclude.some((x) => x.test(h)));
    if (i >= 0) return i;
  }
  return -1;
}

/** "10/31/2026", "2026-10-31", "Oct 31, 2026" → "2026-10-31" (null if not a real date). */
export function parseUsDate(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let mm = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (mm) [y, m, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
  else if ((mm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) [y, m, d] = [Number(mm[3]), Number(mm[1]), Number(mm[2])];
  else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 1800 || y > 2200) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Map a state's business-type wording to Filewell's entity types (null = not supported). */
export function mapEntityType(raw: string): { entityType: EntityType | null; isForeign: boolean | null } {
  const t = raw.toUpperCase();
  const isForeign = /\bFOREIGN\b/.test(t) ? true : /\b(WA|DOMESTIC|NV|UT)\b/.test(t) ? false : null;
  if (/NON ?PROFIT|NONPROFIT|MISCELLANEOUS|MUTUAL|CORPORATION SOLE|COOPERATIVE/.test(t)) return { entityType: null, isForeign };
  if (/LIMITED LIABILITY PARTNERSHIP|\bLLP\b/.test(t)) return { entityType: "llp", isForeign };
  if (/LIMITED LIABILITY COMPANY|\bLLC\b/.test(t)) return { entityType: "llc", isForeign };
  if (/LIMITED PARTNERSHIP|\bLLLP\b|\bLP\b/.test(t)) return { entityType: "lp", isForeign };
  if (/BUSINESS TRUST/.test(t)) return { entityType: "business_trust", isForeign };
  if (/CORPORATION|\bCORP\b|\bINC\b/.test(t)) return { entityType: "corporation", isForeign };
  return { entityType: null, isForeign };
}

export function mapExport(text: string, opts: { normalizeNumber: (raw: string) => string | null; maxRows?: number }): ParseResult {
  const table = parseCsv(text);
  const skipped: { line: number; reason: string }[] = [];
  const empty: ParseResult["columns"] = { entityNumber: null, name: null, typeRaw: null, status: null, dueDate: null, formationDate: null, address: null, agent: null };
  if (table.length < 2) return { rows: [], skipped: [{ line: 1, reason: "No data rows" }], columns: empty };
  const headers = table[0];
  const col = {
    entityNumber: findColumn(headers, [/^ubi/, /\bubi\b/, /entity (number|id|no)/, /business id/, /file number/, /^nv business id/]),
    name: findColumn(headers, [/^(business|entity) name$/, /^name$/, /business name/, /entity name/], [/agent/, /governor/, /principal/]),
    typeRaw: findColumn(headers, [/^(business|entity) type$/, /\btype\b/], [/agent/]),
    status: findColumn(headers, [/^status$/, /business status/, /entity status/, /\bstatus\b/]),
    dueDate: findColumn(headers, [/expiration/, /renewal date/, /annual (list|report) due/, /due date/, /\bexpires?\b/]),
    formationDate: findColumn(headers, [/formation/, /incorporation/, /registration date/, /date of (formation|incorporation|registration)/, /filing date/, /\bfile date\b/]),
    address: findColumn(headers, [/principal office (street )?address/, /principal (street )?address/, /business address/, /^address$/, /\baddress\b/], [/agent/, /mailing/]),
    agent: findColumn(headers, [/registered agent name/, /^registered agent$/, /agent name/, /registered agent/], [/address/]),
  };
  const columns = Object.fromEntries(Object.entries(col).map(([k, i]) => [k, i >= 0 ? headers[i] : null])) as ParseResult["columns"];
  if (col.entityNumber < 0 || col.name < 0) {
    return { rows: [], skipped: [{ line: 1, reason: "Couldn't find the entity number and business name columns" }], columns };
  }
  const rows: ExportRow[] = [];
  const seen = new Set<string>();
  const max = opts.maxRows ?? 20000;
  for (let li = 1; li < table.length; li++) {
    if (rows.length >= max) {
      skipped.push({ line: li + 1, reason: `Row limit (${max}) reached` });
      break;
    }
    const r = table[li];
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const number = opts.normalizeNumber(get(col.entityNumber));
    const name = get(col.name).replace(/\s+/g, " ");
    if (!number || !name) {
      skipped.push({ line: li + 1, reason: "Missing entity number or name" });
      continue;
    }
    if (seen.has(number)) {
      skipped.push({ line: li + 1, reason: "Duplicate entity number" });
      continue;
    }
    seen.add(number);
    const typeRaw = get(col.typeRaw);
    const { entityType, isForeign } = mapEntityType(typeRaw);
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h.trim()) raw[h.trim().slice(0, 80)] = (r[i] ?? "").slice(0, 300);
    });
    rows.push({
      entityNumber: number,
      name: name.slice(0, 300),
      typeRaw: typeRaw.slice(0, 200),
      entityType,
      isForeign,
      status: get(col.status).slice(0, 100) || null,
      dueDate: parseUsDate(get(col.dueDate)),
      formationDate: parseUsDate(get(col.formationDate)),
      address: get(col.address).slice(0, 300) || null,
      agent: get(col.agent).slice(0, 200) || null,
      raw,
    });
  }
  return { rows, skipped, columns };
}
