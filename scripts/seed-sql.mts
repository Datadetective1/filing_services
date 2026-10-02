/**
 * Print idempotent SQL that seeds rules/prices for the given states, built from the same
 * pure builders as scripts/seed.ts (identical content hashes). For applying through a
 * reviewed SQL console where the service key isn't available locally:
 *   npx tsx scripts/seed-sql.mts WA NV UT > seed.sql
 * Existing (rule, version) rows are left untouched.
 */
import { createHash } from "node:crypto";
import { contentHashOf, defaultPriceRows, RULES, ruleRow, sourceRows, stateRows, supersededEffectiveTo, versionRow } from "../src/lib/compliance/seed-data";

const states = process.argv.slice(2).map((s) => s.toUpperCase());
if (!states.length) {
  console.error("Usage: seed-sql.mts <STATE> [...]");
  process.exit(1);
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
const json = (v: unknown) => `$j$${JSON.stringify(v)}$j$::jsonb`;

const out: string[] = ["begin;"];
for (const st of stateRows().filter((s) => states.includes(s.code))) {
  out.push(`update public.states set support_level = ${lit(st.support_level)}, filing_enabled = ${st.filing_enabled} where code = ${lit(st.code)};`);
}
for (const rule of RULES.filter((r) => states.includes(r.stateCode))) {
  const rr = ruleRow(rule);
  const v = versionRow(rule, contentHashOf(rule, sha)) as Record<string, unknown>;
  const cols = Object.keys(v);
  out.push(
    `insert into public.compliance_rules (rule_key, state_code, filing_type_code, entity_type, applies_to) values (${lit(rr.rule_key)}, ${lit(rr.state_code)}, ${lit(rr.filing_type_code)}, ${lit(rr.entity_type)}, ${lit(rr.applies_to)}) on conflict (rule_key) do nothing;`,
  );
  out.push(`with r as (select id from public.compliance_rules where rule_key = ${lit(rule.ruleKey)}),
v as (
  insert into public.state_rule_versions (rule_id, ${cols.join(", ")})
  select r.id, ${cols.map((c) => `x.${c}`).join(", ")}
  from r, jsonb_populate_record(null::public.state_rule_versions, ${json(v)}) x
  where not exists (select 1 from public.state_rule_versions sv where sv.rule_id = r.id and sv.version = ${rule.version})
  returning id, rule_id
),
s as (
  insert into public.state_rule_sources (rule_version_id, fact_key, url, title, publisher, quote, last_verified_at)
  select v.id, y.fact_key, y.url, y.title, y.publisher, y.quote, y.last_verified_at
  from v, jsonb_to_recordset(${json(sourceRows(rule))}) as y(fact_key text, url text, title text, publisher text, quote text, last_verified_at date)
  returning 1
)
update public.compliance_rules c set current_version_id = v.id from v where c.id = v.rule_id;`);
  // Older published versions of this rule are superseded the day before this one takes effect
  // (as scripts/seed.ts does). Idempotent: already-superseded rows are left alone.
  out.push(`update public.state_rule_versions sv set publication_status = 'superseded', effective_to = ${lit(supersededEffectiveTo(rule))}
from public.compliance_rules c
where c.id = sv.rule_id and c.rule_key = ${lit(rule.ruleKey)} and sv.version < ${rule.version} and sv.publication_status = 'published';`);
}
for (const p of defaultPriceRows().filter((p) => states.includes(p.state_code))) {
  out.push(`insert into public.service_prices (filing_type_code, state_code, entity_type, service_fee_cents, approved, active, notes)
select ${lit(p.filing_type_code)}, ${lit(p.state_code)}, null, ${p.service_fee_cents}, false, true, ${lit(p.notes)}
where not exists (select 1 from public.service_prices where filing_type_code = ${lit(p.filing_type_code)} and state_code = ${lit(p.state_code)} and entity_type is null and active);`);
}
out.push("commit;");
console.log(out.join("\n"));
