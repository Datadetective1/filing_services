import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { contentHashOf, RULES } from "@/lib/compliance/seed-data";
import { createTestDb, type Db } from "./harness";

/**
 * scripts/seed-sql.mts (used to seed production through a reviewed SQL console) must
 * produce exactly what scripts/seed.ts produces, and be safe to run twice.
 */

let db: Db;
let sql = "";
const STATES = ["WA", "NV", "UT"];

beforeAll(async () => {
  db = await createTestDb();
  sql = execFileSync(process.execPath, ["--import", "tsx", "scripts/seed-sql.mts", ...STATES], { encoding: "utf8", cwd: process.cwd() });
  // Start from a database without the expansion states' rules and prices.
  // Test-only reset: bypass the immutability triggers for the deletes.
  await db.exec(`
    set session_replication_role = replica;
    update public.compliance_rules set current_version_id = null where state_code in ('WA','NV','UT');
    delete from public.state_rule_sources where rule_version_id in (select v.id from public.state_rule_versions v join public.compliance_rules r on r.id = v.rule_id where r.state_code in ('WA','NV','UT'));
    delete from public.state_rule_versions where rule_id in (select id from public.compliance_rules where state_code in ('WA','NV','UT'));
    delete from public.compliance_rules where state_code in ('WA','NV','UT');
    delete from public.service_prices where state_code in ('WA','NV','UT');
    set session_replication_role = origin;
  `);
}, 120_000);

describe("seed-sql", () => {
  it("creates every expansion rule version with the code's content hash, sources and current version", async () => {
    await db.exec(sql);
    const r = await db.query<{ rule_key: string; content_hash: string; sources: number; current: boolean }>(`
      select c.rule_key, v.content_hash, (select count(*)::int from public.state_rule_sources s where s.rule_version_id = v.id) as sources,
             c.current_version_id = v.id as current
      from public.compliance_rules c join public.state_rule_versions v on v.rule_id = c.id
      where c.state_code in ('WA','NV','UT') order by c.rule_key`);
    const expected = RULES.filter((x) => STATES.includes(x.stateCode));
    expect(r.rows).toHaveLength(expected.length);
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    for (const rule of expected) {
      const row = r.rows.find((x) => x.rule_key === rule.ruleKey)!;
      expect(row.content_hash).toBe(contentHashOf(rule, sha));
      expect(row.sources).toBe(rule.sources.length);
      expect(row.current).toBe(true);
    }
    const prices = await db.query<{ state_code: string; approved: boolean; service_fee_cents: number }>(
      "select state_code, approved, service_fee_cents from public.service_prices where state_code in ('WA','NV','UT') and active order by state_code",
    );
    expect(prices.rows).toEqual([
      { state_code: "NV", approved: false, service_fee_cents: 4900 },
      { state_code: "UT", approved: false, service_fee_cents: 4900 },
      { state_code: "WA", approved: false, service_fee_cents: 4900 },
    ]);
  });

  it("is idempotent", async () => {
    await db.exec(sql);
    const n = await db.query<{ n: number }>("select count(*)::int as n from public.state_rule_versions v join public.compliance_rules r on r.id = v.rule_id where r.state_code in ('WA','NV','UT')");
    expect(n.rows[0].n).toBe(RULES.filter((x) => STATES.includes(x.stateCode)).length);
    const p = await db.query<{ n: number }>("select count(*)::int as n from public.service_prices where state_code in ('WA','NV','UT')");
    expect(p.rows[0].n).toBe(3);
  });
});
