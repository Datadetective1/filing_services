/**
 * Seed reference data into Supabase (idempotent).
 *   npx tsx scripts/seed.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (service role) in the
 * environment or .env.local. Never commit those values.
 *
 * Rule versions are immutable: if a published (rule, version) already exists with a
 * different content hash, the seed FAILS — bump the version in the registry instead.
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  agencyRows,
  contentHashOf,
  defaultPriceRows,
  filingTypeRows,
  reminderScheduleRows,
  RULES,
  ruleRow,
  sourceRows,
  stateRows,
  supersededEffectiveTo,
  templateRows,
  versionRow,
} from "../src/lib/compliance/seed-data";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  await must(db.from("states").upsert(stateRows(), { onConflict: "code" }), "states");
  await must(db.from("state_agencies").upsert(agencyRows(), { onConflict: "state_code" }), "agencies");
  await must(db.from("filing_types").upsert(filingTypeRows(), { onConflict: "code" }), "filing types");
  console.log(`states: ${stateRows().length}, agencies: ${agencyRows().length}, filing types: ${filingTypeRows().length}`);

  for (const rule of RULES) {
    const ruleRec = (await must(
      db.from("compliance_rules").upsert(ruleRow(rule), { onConflict: "rule_key" }).select("id, current_version_id").single(),
      `rule ${rule.ruleKey}`,
    )) as { id: string; current_version_id: string | null };
    const hash = contentHashOf(rule, sha);

    const existing = (await must(
      db.from("state_rule_versions").select("id, content_hash").eq("rule_id", ruleRec.id).eq("version", rule.version).maybeSingle(),
      "version lookup",
    )) as { id: string; content_hash: string } | null;

    if (existing) {
      if (existing.content_hash !== hash) {
        throw new Error(
          `${rule.ruleKey} v${rule.version} is published with different content. Rule versions are immutable — add version ${rule.version + 1}.`,
        );
      }
      if (ruleRec.current_version_id !== existing.id) {
        await must(db.from("compliance_rules").update({ current_version_id: existing.id }).eq("id", ruleRec.id), "set current");
      }
      console.log(`= ${rule.ruleKey} v${rule.version} unchanged`);
      continue;
    }

    const version = (await must(
      db.from("state_rule_versions").insert({ ...versionRow(rule, hash), rule_id: ruleRec.id }).select("id").single(),
      `insert ${rule.ruleKey} v${rule.version}`,
    )) as { id: string };
    const sources = sourceRows(rule).map((s) => ({ ...s, rule_version_id: version.id }));
    if (sources.length) await must(db.from("state_rule_sources").insert(sources), "sources");

    if (ruleRec.current_version_id) {
      await must(
        db
          .from("state_rule_versions")
          .update({ publication_status: "superseded", effective_to: supersededEffectiveTo(rule) })
          .eq("id", ruleRec.current_version_id),
        "supersede previous",
      );
    }
    await must(db.from("compliance_rules").update({ current_version_id: version.id }).eq("id", ruleRec.id), "set current");
    console.log(`+ ${rule.ruleKey} v${rule.version} published (${sources.length} sources)`);
  }

  for (const price of defaultPriceRows()) {
    const existing = await must(
      db.from("service_prices").select("id").eq("filing_type_code", price.filing_type_code).eq("state_code", price.state_code).is("entity_type", null).eq("active", true),
      "price lookup",
    );
    if (!(existing as unknown[]).length) {
      await must(db.from("service_prices").insert(price), "price insert");
      console.log(`+ provisional service price for ${price.state_code} ${price.filing_type_code}`);
    }
  }

  await must(db.from("reminder_schedules").upsert(reminderScheduleRows(), { onConflict: "name" }), "reminder schedules");
  await must(db.from("notification_templates").upsert(templateRows(), { onConflict: "key" }), "templates");
  console.log("reminder schedule + templates up to date");
}

main().then(
  () => console.log("Seed complete."),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
