import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, count, createFilingFixture, createTestDb, createUser, type Db, expectDenied, makeStaff } from "./harness";

/**
 * Partner document alerts in the database: one row per partner document, a matched alert
 * always names its subscription and owner, only the server writes, only staff read, and
 * two subscriptions can't share a partner company ID.
 */

let db: Db;
let A: string;
let S: string;
let aBusiness: string;
let aSub: string;

async function subscription(userId: string, businessId: string, ref: string | null) {
  const o = await db.query<{ id: string }>(
    `insert into public.orders (user_id, business_id, order_type, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode)
     values ($1, $2, 'business_services', 0, 11900, 11900, '{}'::jsonb, 'sandbox') returning id`,
    [userId, businessId],
  );
  const res = await db.query<{ id: string }>(
    `insert into public.ra_subscriptions (user_id, business_id, state_code, plan, origin, order_id, renewal_price_cents, provider_account_ref)
     values ($1, $2, 'TX', 'registered_agent', 'switching', $3, 11900, $4) returning id`,
    [userId, businessId, o.rows[0].id, ref],
  );
  return res.rows[0].id;
}

const insertAlert = (fields: Record<string, unknown>) => {
  const cols = Object.keys(fields);
  return asService(db, (tx) =>
    tx.query(`insert into public.provider_document_events (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(fields)),
  );
};

beforeAll(async () => {
  db = await createTestDb();
  A = await createUser(db);
  S = await createUser(db);
  await makeStaff(db, S, "operator");
  aBusiness = (await createFilingFixture(db, A, { legalName: "Alpha LLC" })).businessId;
  aSub = await subscription(A, aBusiness, "C-100");
});

describe("provider_document_events", () => {
  it("keeps one row per partner document", async () => {
    await insertAlert({ provider_document_id: "D-1", provider_company_id: "C-100", match_status: "matched", ra_subscription_id: aSub, user_id: A, business_id: aBusiness });
    expect(await expectDenied(insertAlert({ provider_document_id: "D-1", match_status: "unmatched" }))).toMatch(/provider_document_events_unique/);
    const res = await asService(db, (tx) =>
      tx.query("insert into public.provider_document_events (provider_document_id, match_status) values ('D-1', 'unmatched') on conflict (provider, provider_document_id) do nothing returning id"),
    );
    expect(res.rows).toHaveLength(0);
  });

  it("a matched alert names its subscription and owner; an unmatched one names none", async () => {
    expect(await expectDenied(insertAlert({ provider_document_id: "D-2", match_status: "matched" }))).toMatch(/matched_has_subscription/);
    expect(await expectDenied(insertAlert({ provider_document_id: "D-3", match_status: "unmatched", ra_subscription_id: aSub, user_id: A, business_id: aBusiness }))).toMatch(
      /matched_has_subscription/,
    );
    expect(await expectDenied(insertAlert({ provider_document_id: "D-4", match_status: "matched", ra_subscription_id: aSub }))).toMatch(/matched_has_owner/);
    expect(await expectDenied(insertAlert({ provider_document_id: "D-5", match_status: "maybe" }))).toMatch(/check/);
  });

  it("only staff read alerts; customers and anonymous visitors see nothing and write nothing", async () => {
    await asUser(db, S, async (tx) => expect(await count(tx, "select 1 from public.provider_document_events")).toBeGreaterThan(0));
    await asUser(db, A, async (tx) => expect(await count(tx, "select 1 from public.provider_document_events")).toBe(0));
    expect(await expectDenied(asAnon(db, (tx) => tx.query("select 1 from public.provider_document_events")))).toMatch(/permission denied/);
    expect(
      await expectDenied(asUser(db, A, (tx) => tx.query("insert into public.provider_document_events (provider_document_id, match_status) values ('D-9', 'unmatched')"))),
    ).toMatch(/permission denied/);
    expect(await expectDenied(asUser(db, S, (tx) => tx.query("update public.provider_document_events set handled_at = now()")))).toMatch(/permission denied/);
  });

  it("two subscriptions can't share a partner company ID", async () => {
    const b2 = (await createFilingFixture(db, A, { legalName: "Second LLC" })).businessId;
    const b3 = (await createFilingFixture(db, A, { legalName: "Third LLC" })).businessId;
    expect(await expectDenied(subscription(A, b2, "C-100"))).toMatch(/ra_subscriptions_provider_account_ref_unique/);
    // Subscriptions without a company ID yet are fine side by side.
    await subscription(A, b2, null);
    await subscription(A, b3, null);
  });
});
