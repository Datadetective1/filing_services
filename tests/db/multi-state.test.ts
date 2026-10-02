import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, createFilingFixture, createOrderFixture, createTestDb, createUser, type Db } from "./harness";

/** 20261002000012 multi-state: itemized fee columns seeded, public, late-fee order lines. */

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("multi-state rule versions", () => {
  it("seeds Nevada's two fee components and Washington's status-based delinquency rule", async () => {
    const nv = await asService(db, (tx) =>
      tx.query<{ fee_components: { key: string; cents: number }[]; state_fee_cents: number }>(
        "select v.fee_components, v.state_fee_cents from public.state_rule_versions v join public.compliance_rules r on r.id = v.rule_id where r.rule_key = 'NV:annual_report:llc'",
      ),
    );
    expect(nv.rows[0].state_fee_cents).toBe(35000);
    expect(nv.rows[0].fee_components.map((c) => [c.key, c.cents])).toEqual([
      ["annual_list", 15000],
      ["business_license", 20000],
    ]);
    const wa = await asService(db, (tx) =>
      tx.query<{ late_fees: { trigger: { kind: string; statuses: string[] } }[]; filing_window_days_before: number }>(
        "select v.late_fees, v.filing_window_days_before from public.state_rule_versions v join public.compliance_rules r on r.id = v.rule_id where r.rule_key = 'WA:annual_report:llc'",
      ),
    );
    expect(wa.rows[0].late_fees[0].trigger).toEqual({ kind: "state_status", statuses: ["Delinquent"] });
    expect(wa.rows[0].filing_window_days_before).toBe(180);
  });

  it("the new fee columns are public facts (anon can read them)", async () => {
    const r = await asAnon(db, (tx) => tx.query("select fee_components, late_fees, filing_window_days_before from public.state_rule_versions limit 1"));
    expect(r.rows).toHaveLength(1);
  });

  it("PA versions carry no components (their single fee is unchanged)", async () => {
    const r = await asService(db, (tx) =>
      tx.query<{ n: number }>(
        "select count(*)::int as n from public.state_rule_versions v join public.compliance_rules r on r.id = v.rule_id where r.state_code = 'PA' and v.fee_components is not null",
      ),
    );
    expect(r.rows[0].n).toBe(0);
  });
});

describe("order lines", () => {
  it("accept a government late fee line, kept apart from the service fee", async () => {
    const user = await createUser(db);
    const f = await createFilingFixture(db, user);
    const { orderId } = await createOrderFixture(db, user, f.filingId, f.businessId);
    await asService(db, (tx) =>
      tx.query("insert into public.order_items (order_id, filing_id, kind, description, amount_cents) values ($1, $2, 'government_late_fee', 'Washington Delinquency fee, paid to the state', 2500)", [
        orderId,
        f.filingId,
      ]),
    );
    await expect(
      asService(db, (tx) => tx.query("insert into public.order_items (order_id, kind, description, amount_cents) values ($1, 'penalty_revenue', 'x', 1)", [orderId])),
    ).rejects.toThrow();
  });
});

describe("state entity records", () => {
  it("store the state's own due date and when its status was read", async () => {
    await asService(db, (tx) =>
      tx.query(
        "insert into public.state_entity_records (state_code, entity_number, legal_name, source, retrieved_at, status_raw, status_checked_at, due_date) values ('WA', '604123456', 'Cascade Plumbing, LLC', 'wa_ccfs_export', now(), 'Delinquent', now(), '2026-10-31')",
      ),
    );
    const r = await asService(db, (tx) => tx.query<{ due_date: unknown }>("select due_date from public.state_entity_records where entity_number = '604123456'"));
    expect(r.rows).toHaveLength(1);
  });
});
