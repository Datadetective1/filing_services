import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
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
  templateRows,
  versionRow,
} from "@/lib/compliance/seed-data";

/**
 * Database test harness: real Postgres (PGlite/WASM) running the project's actual
 * migrations, with a minimal Supabase shim — the `auth` schema, `auth.uid()` reading
 * the JWT subject from a setting, and the anon/authenticated/service_role roles.
 * Row-level security, triggers and SECURITY DEFINER functions behave as in Supabase.
 */

const SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  email_confirmed_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const POST_MIGRATION_GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant select on auth.users to service_role;
`;

const MIGRATIONS = [
  "20260927000001_schema.sql",
  "20260927000002_functions.sql",
  "20260927000003_rls.sql",
];

export type Db = PGlite;

export async function createTestDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(SHIM);
  // Supabase's default grants happen before migrations; mirror by granting after
  // table creation but BEFORE the RLS migration's column-level revokes run.
  const dir = path.join(process.cwd(), "supabase", "migrations");
  await db.exec(readFileSync(path.join(dir, MIGRATIONS[0]), "utf8"));
  await db.exec(readFileSync(path.join(dir, MIGRATIONS[1]), "utf8"));
  await db.exec(POST_MIGRATION_GRANTS);
  await db.exec(readFileSync(path.join(dir, MIGRATIONS[2]), "utf8"));
  await seedReference(db);
  return db;
}

async function insertRows(db: Db | Transaction, table: string, rows: Record<string, unknown>[], returning?: string) {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const cols = Object.keys(row);
    const values = cols.map((c) => {
      const v = row[c];
      return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
    });
    const casts = cols.map((c, i) => {
      const v = row[c];
      if (Array.isArray(v) && typeof v[0] === "number") return `$${i + 1}::int[]`;
      if (v !== null && typeof v === "object") return `$${i + 1}::jsonb`;
      return `$${i + 1}`;
    });
    // int[] must be passed as a Postgres array literal
    const params = values.map((v, i) => (Array.isArray(row[cols[i]]) && typeof (row[cols[i]] as unknown[])[0] === "number" ? `{${(row[cols[i]] as number[]).join(",")}}` : v));
    const res = await db.query(
      `insert into public.${table} (${cols.join(",")}) values (${casts.join(",")})${returning ? ` returning ${returning}` : ""}`,
      params,
    );
    out.push(...(res.rows as Record<string, unknown>[]));
  }
  return out;
}

async function seedReference(db: Db) {
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  await insertRows(db, "states", stateRows());
  await insertRows(db, "state_agencies", agencyRows());
  await insertRows(db, "filing_types", filingTypeRows());
  for (const rule of RULES) {
    const [r] = await insertRows(db, "compliance_rules", [ruleRow(rule)], "id");
    const [v] = await insertRows(db, "state_rule_versions", [{ ...versionRow(rule, contentHashOf(rule, sha)), rule_id: r.id }], "id");
    await insertRows(db, "state_rule_sources", sourceRows(rule).map((s) => ({ ...s, rule_version_id: v.id })));
    await db.query("update public.compliance_rules set current_version_id = $1 where id = $2", [v.id, r.id]);
  }
  await insertRows(db, "service_prices", defaultPriceRows());
  await insertRows(db, "reminder_schedules", reminderScheduleRows());
  await insertRows(db, "notification_templates", templateRows());
}

// ---------------------------------------------------------------------------
// Acting as different principals
// ---------------------------------------------------------------------------

type Role = { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" };

export async function as<T>(db: Db, role: Role, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    if (role.kind === "anon") {
      await tx.exec("set local role anon");
    } else if (role.kind === "user") {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [role.id]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.exec("set local role service_role");
    }
    return fn(tx);
  });
}

export const asUser = <T>(db: Db, id: string, fn: (tx: Transaction) => Promise<T>) => as(db, { kind: "user", id }, fn);
export const asAnon = <T>(db: Db, fn: (tx: Transaction) => Promise<T>) => as(db, { kind: "anon" }, fn);
export const asService = <T>(db: Db, fn: (tx: Transaction) => Promise<T>) => as(db, { kind: "service" }, fn);

/** Expect a statement to be rejected (RLS violation, permission denied, trigger, check). */
export async function expectDenied(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  throw new Error("Expected the statement to be denied, but it succeeded");
}

export async function createUser(db: Db, email = `${randomUUID()}@example.test`): Promise<string> {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())", [id, email]);
  return id;
}

export async function makeStaff(db: Db, userId: string, role: "admin" | "operator" = "admin") {
  await db.query("insert into public.staff_members (user_id, role) values ($1, $2)", [userId, role]);
}

export async function ruleVersionId(db: Db, ruleKey = "PA:annual_report:llc"): Promise<{ ruleId: string; versionId: string }> {
  const res = await db.query<{ id: string; current_version_id: string }>(
    "select id, current_version_id from public.compliance_rules where rule_key = $1",
    [ruleKey],
  );
  return { ruleId: res.rows[0].id, versionId: res.rows[0].current_version_id };
}

/** Create a business + requirement + draft filing for `userId` the way the server does. */
export async function createFilingFixture(db: Db, userId: string, opts: { legalName?: string; dueDate?: string } = {}) {
  const { ruleId, versionId } = await ruleVersionId(db);
  const business = await asUser(db, userId, (tx) =>
    tx.query<{ id: string }>(
      "insert into public.businesses (owner_user_id, legal_name, state_code, entity_type) values ($1, $2, 'PA', 'llc') returning id",
      [userId, opts.legalName ?? "Acme Holdings LLC"],
    ),
  );
  const businessId = business.rows[0].id;
  const due = opts.dueDate ?? "2026-09-30";
  const req = await db.query<{ id: string }>(
    "insert into public.filing_requirements (business_id, owner_user_id, rule_id, period_year, due_date) values ($1, $2, $3, $4, $5) returning id",
    [businessId, userId, ruleId, Number(due.slice(0, 4)), due],
  );
  const snapshot = await db.query<{ row: unknown }>("select to_jsonb(v) as row from public.state_rule_versions v where id = $1", [versionId]);
  const filing = await db.query<{ id: string }>(
    `insert into public.filings (user_id, business_id, requirement_id, state_code, filing_type_code, rule_version_id, rule_snapshot, period_year, due_date)
     values ($1, $2, $3, 'PA', 'annual_report', $4, $5::jsonb, $6, $7) returning id`,
    [userId, businessId, req.rows[0].id, versionId, JSON.stringify(snapshot.rows[0].row), Number(due.slice(0, 4)), due],
  );
  const filingId = filing.rows[0].id;
  await asUser(db, userId, (tx) =>
    tx.query("insert into public.filing_answers (filing_id, user_id, answers, is_complete) values ($1, $2, $3::jsonb, true)", [
      filingId,
      userId,
      JSON.stringify({ legal_name: opts.legalName ?? "Acme Holdings LLC" }),
    ]),
  );
  return { businessId, requirementId: req.rows[0].id, filingId, ruleId, versionId };
}

/** Create an order + pending payment for a filing (as the server does at checkout). */
export async function createOrderFixture(db: Db, userId: string, filingId: string, businessId: string, totals = { gov: 700, svc: 4900 }) {
  const order = await db.query<{ id: string }>(
    `insert into public.orders (user_id, business_id, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode)
     values ($1, $2, $3, $4, $5, '{}'::jsonb, 'sandbox') returning id`,
    [userId, businessId, totals.gov, totals.svc, totals.gov + totals.svc],
  );
  const orderId = order.rows[0].id;
  await db.query("update public.filings set order_id = $1 where id = $2", [orderId, filingId]);
  const payment = await db.query<{ id: string }>(
    `insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id)
     values ($1, $2, 'sandbox', 'sandbox', $3, $4) returning id`,
    [orderId, userId, totals.gov + totals.svc, `sbx_cs_${randomUUID().replace(/-/g, "")}`],
  );
  return { orderId, paymentId: payment.rows[0].id };
}

export async function authorize(db: Db, userId: string, filingId: string) {
  await db.query(
    `insert into public.filing_authorizations (filing_id, user_id, signer_name, signer_title, attested_accurate, authorized_submission, terms_version, authorization_text, answers_sha256, answers_snapshot)
     values ($1, $2, 'Jane Owner', 'Managing Member', true, true, 'test', 'text', $3, '{}'::jsonb)`,
    [filingId, userId, "a".repeat(64)],
  );
}
