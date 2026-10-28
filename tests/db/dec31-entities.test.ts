import { beforeAll, describe, expect, it } from "vitest";
import { evaluateFees, feeSourceFromSnapshot, quoteGovernmentLines } from "@/lib/compliance/fees";
import { buildQuote, resolveServicePrice, type ServicePrice } from "@/lib/domain/pricing";
import type { EntityType } from "@/lib/domain/types";
import { asService, asUser, authorize, createOrderFixture, createTestDb, createUser, type Db, filingStatus, ruleVersionId } from "./harness";

/**
 * Pennsylvania entity types due December 31, from the published rule version to a paid
 * order, in real Postgres with the production migrations. The service price is set up
 * as production holds it: one active, approved PA row for every entity type
 * (entity_type null), $49.
 */

const DEC31: { entityType: EntityType; isNonprofit: boolean; gov: number; total: number }[] = [
  { entityType: "lp", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "llp", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "electing_partnership", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "professional_association", isNonprofit: false, gov: 700, total: 5600 },
  { entityType: "business_trust", isNonprofit: false, gov: 700, total: 5600 },
  // A limited partnership with a not-for-profit purpose pays no state fee.
  { entityType: "lp", isNonprofit: true, gov: 0, total: 4900 },
];

const label = (c: (typeof DEC31)[number]) => `${c.isNonprofit ? "nonprofit " : ""}${c.entityType}`;

let db: Db;
let owner: string;
let paPriceId: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
  const approver = await createUser(db);
  // Production: the PA row approved by the owner (FIRST_CUSTOMER_READINESS.md, section 2).
  const res = await db.query<{ id: string }>(
    "update public.service_prices set approved = true, approved_at = now(), approved_by = $1, service_fee_cents = 4900 where state_code = 'PA' and entity_type is null and active returning id",
    [approver],
  );
  expect(res.rows).toHaveLength(1);
  paPriceId = res.rows[0].id;
});

async function activePrices(): Promise<ServicePrice[]> {
  const res = await asService(db, (tx) =>
    tx.query<Record<string, unknown>>("select id, filing_type_code, state_code, entity_type, service_fee_cents, approved, active from public.service_prices where active"),
  );
  return res.rows.map((p) => ({
    id: String(p.id),
    filingTypeCode: String(p.filing_type_code),
    stateCode: (p.state_code as string | null) ?? null,
    entityType: (p.entity_type as string | null) ?? null,
    serviceFeeCents: Number(p.service_fee_cents),
    approved: Boolean(p.approved),
    active: Boolean(p.active),
  }));
}

async function snapshotFor(versionId: string): Promise<Record<string, unknown>> {
  const res = await db.query<{ row: Record<string, unknown> }>("select to_jsonb(v) as row from public.state_rule_versions v where id = $1", [versionId]);
  return res.rows[0].row;
}

/** The order quote exactly as quoteForFiling builds it, from the filing's frozen rule snapshot. */
function quoteFrom(snapshot: Record<string, unknown>, price: ServicePrice, isNonprofit: boolean) {
  const gov = quoteGovernmentLines(
    evaluateFees(feeSourceFromSnapshot(snapshot), { isNonprofit, dueDate: "2026-12-31", filingDate: "2026-10-28", status: null }),
  );
  return buildQuote({ stateName: "Pennsylvania", filingName: String(snapshot.filing_name), governmentFeeCents: gov.totalCents, governmentLines: gov.lines, price });
}

/** Business + requirement + draft filing for this entity type, the way the server creates them. */
async function filingFor(entityType: EntityType, isNonprofit: boolean) {
  const { ruleId, versionId } = await ruleVersionId(db, `PA:annual_report:${entityType}`);
  const legalName = `Dec31 ${isNonprofit ? "Nonprofit " : ""}${entityType} Test`;
  const business = await asUser(db, owner, (tx) =>
    tx.query<{ id: string }>(
      "insert into public.businesses (owner_user_id, legal_name, state_code, entity_type, is_nonprofit) values ($1, $2, 'PA', $3, $4) returning id",
      [owner, legalName, entityType, isNonprofit],
    ),
  );
  const businessId = business.rows[0].id;
  const req = await db.query<{ id: string }>(
    "insert into public.filing_requirements (business_id, owner_user_id, rule_id, period_year, due_date) values ($1, $2, $3, 2026, '2026-12-31') returning id",
    [businessId, owner, ruleId],
  );
  const snapshot = await snapshotFor(versionId);
  const filing = await db.query<{ id: string }>(
    `insert into public.filings (user_id, business_id, requirement_id, state_code, filing_type_code, rule_version_id, rule_snapshot, period_year, due_date)
     values ($1, $2, $3, 'PA', 'annual_report', $4, $5::jsonb, 2026, '2026-12-31') returning id`,
    [owner, businessId, req.rows[0].id, versionId, JSON.stringify(snapshot)],
  );
  const filingId = filing.rows[0].id;
  await asUser(db, owner, (tx) =>
    tx.query("insert into public.filing_answers (filing_id, user_id, answers, is_complete) values ($1, $2, $3::jsonb, true)", [
      filingId,
      owner,
      JSON.stringify({ legal_name: legalName }),
    ]),
  );
  return { businessId, filingId, snapshot };
}

describe.each(DEC31)("PA $entityType (nonprofit: $isNonprofit), due December 31", (c) => {
  it("has a published, verified rule version due December 31 with the verified state fee", async () => {
    const { versionId } = await ruleVersionId(db, `PA:annual_report:${c.entityType}`);
    const v = await snapshotFor(versionId);
    expect(v).toMatchObject({ publication_status: "published", verification_status: "verified", state_fee_cents: 700 });
    expect(v.due_rule).toEqual({ kind: "fixed_annual", month: 12, day: 31 });
  });

  it("finds the approved PA service price", async () => {
    const price = resolveServicePrice(await activePrices(), { filingTypeCode: "annual_report", stateCode: "PA", entityType: c.entityType });
    expect(price).toMatchObject({ id: paPriceId, approved: true, serviceFeeCents: 4900 });
  });

  it(`totals state fee + $49 service fee (${label(c)}: $${c.total / 100})`, async () => {
    const { versionId } = await ruleVersionId(db, `PA:annual_report:${c.entityType}`);
    const price = resolveServicePrice(await activePrices(), { filingTypeCode: "annual_report", stateCode: "PA", entityType: c.entityType })!;
    const quote = quoteFrom(await snapshotFor(versionId), price, c.isNonprofit);
    expect(quote).toMatchObject({ governmentFeeCents: c.gov, serviceFeeCents: 4900, totalCents: c.total, servicePriceApproved: true });
    // The state fee and our fee stay separate lines (a $0 state line is dropped by the Stripe adapter).
    expect(quote.lineItems.map((li) => [li.kind, li.amountCents])).toEqual([
      ["government_fee", c.gov],
      ["service_fee", 4900],
    ]);
  });

  it("an authorized filing's order at that total is paid and moves to the operator's review", async () => {
    const f = await filingFor(c.entityType, c.isNonprofit);
    const price = resolveServicePrice(await activePrices(), { filingTypeCode: "annual_report", stateCode: "PA", entityType: c.entityType })!;
    const quote = quoteFrom(f.snapshot, price, c.isNonprofit);
    await authorize(db, owner, f.filingId);
    const o = await createOrderFixture(db, owner, f.filingId, f.businessId, { gov: quote.governmentFeeCents, svc: quote.serviceFeeCents });

    const res = await asService(db, (tx) =>
      tx.query<{ r: { applied: boolean; newly_paid?: boolean } }>(
        "select public.apply_payment_success($1::uuid, $2, null, $3::int, 'usd', now()) as r",
        [o.paymentId, `pi_${o.paymentId.slice(0, 8)}`, c.total],
      ),
    );
    expect(res.rows[0].r).toMatchObject({ applied: true, newly_paid: true });
    const order = await db.query<{ status: string; total_cents: number; government_fee_cents: number; service_fee_cents: number }>(
      "select status, total_cents, government_fee_cents, service_fee_cents from public.orders where id = $1",
      [o.orderId],
    );
    expect(order.rows[0]).toEqual({ status: "paid", total_cents: c.total, government_fee_cents: c.gov, service_fee_cents: 4900 });
    expect(await filingStatus(db, f.filingId)).toBe("ready_for_review");
  });
});
