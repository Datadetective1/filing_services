import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, count, createTestDb, createUser, type Db, expectDenied, makeStaff } from "./harness";

/**
 * Column grants on public reference tables (supabase/migrations/20260929000007_column_grants.sql).
 * The publishable key is public, so anon must never read internal columns: price notes, the
 * staff user ids that changed or approved a price, rule research notes and reviewer. Staff
 * pages that read those columns with the signed-in client must keep working.
 */

const PERMISSION = /permission denied/;
// Keep in step with PUBLIC_PRICE_COLUMNS in src/lib/filings/rules-db.ts (listActivePrices).
const PUBLIC_PRICE_COLUMNS = "id, filing_type_code, state_code, entity_type, service_fee_cents, approved, active";
// The /admin/pricing query (src/app/admin/pricing/page.tsx), which runs as the signed-in staff member.
const ADMIN_PRICE_COLUMNS =
  "id, filing_type_code, state_code, entity_type, service_fee_cents, approved, approved_at, approved_by, active, notes, updated_by, updated_at";

let db: Db;
let customer: string;
let staff: string;

beforeAll(async () => {
  db = await createTestDb();
  customer = await createUser(db);
  staff = await createUser(db);
  await makeStaff(db, staff, "operator");
  // An internal note and staff ids on the active price, plus an inactive price.
  await db.query("update public.service_prices set notes = 'internal: margin check', updated_by = $1, approved_by = $1 where active", [staff]);
  await db.query(
    "insert into public.service_prices (filing_type_code, state_code, entity_type, service_fee_cents, active, notes) values ('annual_report', 'PA', 'llc', 1, false, 'old draft')",
  );
}, 60_000);

describe("service_prices column grants", () => {
  it("anon reads the public price columns of active prices (the listActivePrices query)", async () => {
    const res = await asAnon(db, (tx) =>
      tx.query<{ service_fee_cents: number; active: boolean }>(`select ${PUBLIC_PRICE_COLUMNS} from public.service_prices where active = true`),
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].active).toBe(true);
    expect(res.rows[0].service_fee_cents).toBeGreaterThanOrEqual(0);
    // Inactive prices stay hidden from anon.
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.service_prices where not active"))).toBe(0);
  });

  it("anon cannot select service_prices.notes or any other internal column", async () => {
    for (const column of ["notes", "approved_by", "updated_by", "approved_at", "updated_at", "created_at"]) {
      expect(await expectDenied(asAnon(db, (tx) => tx.query(`select ${column} from public.service_prices`))), column).toMatch(PERMISSION);
    }
    // select * (PostgREST's default) is refused too, so nothing leaks through a wildcard.
    expect(await expectDenied(asAnon(db, (tx) => tx.query("select * from public.service_prices")))).toMatch(PERMISSION);
    // Nor through filtering on a hidden column.
    expect(
      await expectDenied(asAnon(db, (tx) => tx.query("select id from public.service_prices where notes like 'internal%'"))),
    ).toMatch(PERMISSION);
  });

  it("signed-in customers see no price rows, so no internal columns either", async () => {
    expect(await asUser(db, customer, (tx) => count(tx, "select 1 from public.service_prices"))).toBe(0);
    const res = await asUser(db, customer, (tx) => tx.query("select notes, approved_by, updated_by from public.service_prices"));
    expect(res.rows).toHaveLength(0);
  });

  it("staff still read every price with its internal columns (the /admin/pricing query)", async () => {
    const res = await asUser(db, staff, (tx) =>
      tx.query<{ active: boolean; notes: string | null; approved_by: string | null; updated_by: string | null }>(
        `select ${ADMIN_PRICE_COLUMNS} from public.service_prices order by active desc`,
      ),
    );
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({ active: true, notes: "internal: margin check", approved_by: staff, updated_by: staff });
    expect(res.rows[1]).toMatchObject({ active: false, notes: "old draft" });
    // The /admin dashboard query (active prices, public columns).
    expect(await asUser(db, staff, (tx) => count(tx, `select ${PUBLIC_PRICE_COLUMNS} from public.service_prices where active`))).toBe(1);
  });
});

describe("state_rule_versions column grants", () => {
  it("anon cannot select rule version notes or verified_by", async () => {
    for (const column of ["notes", "verified_by"]) {
      expect(await expectDenied(asAnon(db, (tx) => tx.query(`select ${column} from public.state_rule_versions`))), column).toMatch(
        PERMISSION,
      );
    }
    expect(await expectDenied(asAnon(db, (tx) => tx.query("select * from public.state_rule_versions")))).toMatch(PERMISSION);
  });

  it("anon still reads the public facts of published versions, and their sources", async () => {
    const res = await asAnon(db, (tx) =>
      tx.query<{ filing_name: string; state_fee_cents: number }>(
        "select id, filing_name, state_fee_cents, due_rule, faq, official_filing_url, last_verified_at from public.state_rule_versions where publication_status = 'published'",
      ),
    );
    expect(res.rows).toHaveLength(8);
    // The sources policy checks visibility through a subquery on state_rule_versions, run as anon.
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.state_rule_sources"))).toBeGreaterThan(8);
  });

  it("staff still select every column of rule versions (the /admin/rules/[code] query)", async () => {
    const res = await asUser(db, staff, (tx) => tx.query<{ verified_by: string | null }>("select * from public.state_rule_versions"));
    expect(res.rows.length).toBeGreaterThanOrEqual(8);
    expect(res.rows.every((r) => typeof r.verified_by === "string")).toBe(true);
  });
});
