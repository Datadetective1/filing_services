/**
 * Build a December 31 postcard pilot cohort from the Pennsylvania Department of State open
 * dataset (data.pa.gov, public domain). Reads public data only; no secrets, no database.
 *
 *   npx tsx scripts/build-pa-mail-cohort.mts --size 100 --pool 600 --today 2026-10-01 --out cohort.json [--exclude-entities 0000001,0000002]
 *
 * Uses the same rules as the app (src/lib/outreach/mail.ts): domestic Dec 31 associations,
 * not first-year, clean Pennsylvania street address not shared with ANY other registered
 * entity, no care-of/agent lines, no P.O. boxes. Business-level fields only (no person names).
 */
import { writeFileSync } from "node:fs";
import { cohortExclusions, selectCohort, type CohortExclusion, addressKey } from "../src/lib/outreach/mail";
import { assessSituation } from "../src/lib/outreach/segment";
import { mapRegistrationType, tidyBusinessName } from "../src/lib/registry/pa-open-data-map";

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const SIZE = Number(arg("size", "100"));
const POOL = Number(arg("pool", "600"));
const TODAY = arg("today", new Date().toISOString().slice(0, 10));
const OUT = arg("out", "cohort.json");
const EXCLUDE = new Set(arg("exclude-entities", "").split(",").filter(Boolean).map((e) => e.padStart(10, "0")));

const HOST = "https://data.pa.gov/resource";
const TYPES = ["Domestic Limited Partnership (LP/LLLP)", "Domestic Business Trust", "Domestic Professional Association"];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

async function soql(dataset: string, params: Record<string, string>): Promise<Record<string, string>[]> {
  const url = new URL(`${HOST}/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Filewell cohort builder (support@getfilewell.com)" } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as Record<string, string>[];
}

const cols = "filing_number, business_name, typeofbusinessregistration, address_line1, address_line2, city, state, zip, shortcountyname, creationdate";
// Newer registrations first (more likely to still be reachable at the address on record);
// the stable hash order then picks within the eligible pool.
const rows = await soql("xvd7-5r2c", {
  $select: cols,
  $where: `typeofbusinessregistration in (${TYPES.map(q).join(", ")}) AND state = 'PA' AND creationdate < '${TODAY.slice(0, 4)}-01-01T00:00:00'`,
  $group: cols,
  $order: "creationdate DESC",
  $limit: String(POOL),
});
const seen = new Set<string>();
const candidates = rows.filter((r) => r.filing_number && !seen.has(r.filing_number) && seen.add(r.filing_number));

// Register-wide count of entities at each candidate street address (all entity types).
const counts = new Map<string, number>();
const lines = [...new Set(candidates.map((r) => r.address_line1).filter(Boolean))];
for (let i = 0; i < lines.length; i += 40) {
  const batch = lines.slice(i, i + 40);
  const res = await soql("3urc-uaba", {
    $select: "address_line1, zip, count(*) as n",
    $where: `address_line1 in (${batch.map(q).join(", ")})`,
    $group: "address_line1, zip",
    $limit: "5000",
  });
  for (const r of res) {
    const k = addressKey({ line1: r.address_line1, postal_code: r.zip });
    if (k) counts.set(k, (counts.get(k) ?? 0) + Number(r.n));
  }
}

const evaluated = candidates.map((r) => {
  const t = mapRegistrationType(r.typeofbusinessregistration);
  const created = (r.creationdate ?? "").slice(0, 10);
  const address = r.address_line1
    ? { line1: r.address_line1, line2: r.address_line2 ?? "", city: r.city ?? "", region: r.state ?? "", postal_code: (r.zip ?? "").replace(/-0*$/, ""), county: r.shortcountyname ?? "" }
    : null;
  const situation = assessSituation({ stateCode: "PA", entityType: t.entityType, isForeign: t.isForeign, formationDate: created || null, filedYears: null, today: TODAY });
  const k = addressKey(address);
  const exclusions: CohortExclusion[] = cohortExclusions({
    entityType: t.entityType,
    isForeign: t.isForeign,
    address,
    situation,
    isCustomer: EXCLUDE.has(r.filing_number),
    sharedCount: k ? (counts.get(k) ?? 1) : 0,
    registerAddressCount: k ? (counts.get(k) ?? 1) : 0,
    legalName: tidyBusinessName(r.business_name),
  });
  return {
    entityNumber: r.filing_number,
    legalName: tidyBusinessName(r.business_name),
    entityTypeRaw: r.typeofbusinessregistration,
    entityType: t.entityType,
    isForeign: t.isForeign,
    formationDate: created || null,
    address,
    dueDate: situation.kind === "assessed" ? situation.dueDate : null,
    exclusions,
  };
});

const { selected, excluded } = selectCohort(evaluated, SIZE);
const reasons: Record<string, number> = {};
for (const r of excluded) for (const x of r.exclusions.length ? r.exclusions : ["eligible_reserve"]) reasons[x] = (reasons[x] ?? 0) + 1;
writeFileSync(OUT, JSON.stringify({ today: TODAY, size: SIZE, considered: evaluated.length, selected, excluded, reasons }, null, 1));
console.log(JSON.stringify({ considered: evaluated.length, selected: selected.length, excluded: excluded.length, reasons }, null, 1));
