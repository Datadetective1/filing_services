import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, count, createFilingFixture, createTestDb, createUser, type Db, expectDenied, makeStaff } from "./harness";

/**
 * Business services in the database itself: customers see only their own registered agent
 * rows, nobody but the server writes them, payment never makes an appointment active, the
 * provider order status machine refuses skipped steps, and a bundle year can't include the
 * same annual report twice.
 */

const SHA = "c".repeat(64);

let db: Db;
let A: string;
let B: string;
let S: string;
let aBusiness: string;
let aRequirement: string;
let aSub: string;
let aOrder: string;
let aProviderOrder: string;
let aDoc: string;

async function serviceOrder(userId: string, businessId: string) {
  const o = await db.query<{ id: string }>(
    `insert into public.orders (user_id, business_id, order_type, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode)
     values ($1, $2, 'business_services', 1500, 11900, 13400, '{}'::jsonb, 'sandbox') returning id`,
    [userId, businessId],
  );
  return o.rows[0].id;
}

async function subscription(userId: string, businessId: string, orderId: string, extra: Record<string, unknown> = {}) {
  const cols = ["user_id", "business_id", "state_code", "plan", "origin", "order_id", "renewal_price_cents", ...Object.keys(extra)];
  const vals = [userId, businessId, "PA", "registered_agent", "switching", orderId, 11900, ...Object.values(extra)];
  const res = await db.query<{ id: string }>(
    `insert into public.ra_subscriptions (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    vals,
  );
  return res.rows[0].id;
}

const move = (id: string, to: string, patch: Record<string, unknown> = {}) =>
  asService(db, (tx) => tx.query("select status from public.transition_provider_order($1, $2, null, 'staff', null, true, $3::jsonb)", [id, to, JSON.stringify(patch)]));

beforeAll(async () => {
  db = await createTestDb();
  A = await createUser(db);
  B = await createUser(db);
  S = await createUser(db);
  await makeStaff(db, S, "operator");
  const fa = await createFilingFixture(db, A, { legalName: "Alpha LLC" });
  const fb = await createFilingFixture(db, B, { legalName: "Beta LLC" });
  aBusiness = fa.businessId;
  aRequirement = (await db.query<{ requirement_id: string }>("select requirement_id from public.filings where id = $1", [fa.filingId])).rows[0].requirement_id;
  aOrder = await serviceOrder(A, aBusiness);
  aSub = await subscription(A, aBusiness, aOrder, { contact_name: "Jo Alpha", contact_phone: "(215) 555-0100", contact_address: "1 Market St, Philadelphia" });
  const po = await db.query<{ id: string }>(
    "insert into public.provider_orders (user_id, business_id, order_id, ra_subscription_id, kind, state_code) values ($1, $2, $3, $4, 'registered_agent', 'PA') returning id",
    [A, aBusiness, aOrder, aSub],
  );
  aProviderOrder = po.rows[0].id;
  const doc = await db.query<{ id: string }>(
    `insert into public.service_documents (user_id, business_id, ra_subscription_id, kind, urgency, storage_path, file_name, mime_type, size_bytes, sha256)
     values ($1, $2, $3, 'service_of_process', 'urgent', 'a/ra/x/1-summons.pdf', 'summons.pdf', 'application/pdf', 1000, $4) returning id`,
    [A, aBusiness, aSub, SHA],
  );
  aDoc = doc.rows[0].id;
  await db.query(
    "insert into public.order_economics (order_id, service_code, fulfillment_method, service_revenue_cents, wholesale_cost_cents) values ($1, 'registered_agent', 'registered_agents_inc', 11900, 4500)",
    [aOrder],
  );
  const bOrder = await serviceOrder(B, fb.businessId);
  await subscription(B, fb.businessId, bOrder);
});

describe("tenant isolation", () => {
  it("customers see their own registered agent rows and nobody else's", async () => {
    await asUser(db, A, async (tx) => {
      expect(await count(tx, "select 1 from public.ra_subscriptions")).toBe(1);
      expect(await count(tx, "select 1 from public.provider_orders")).toBe(1);
      expect(await count(tx, "select 1 from public.service_documents")).toBe(1);
    });
    await asUser(db, B, async (tx) => {
      expect(await count(tx, "select 1 from public.ra_subscriptions")).toBe(1);
      expect(await count(tx, "select 1 from public.ra_subscriptions where id = $1", [aSub])).toBe(0);
      expect(await count(tx, "select 1 from public.provider_orders")).toBe(0);
      expect(await count(tx, "select 1 from public.service_documents where id = $1", [aDoc])).toBe(0);
    });
  });

  it("economics and notification attempts are staff only", async () => {
    await asUser(db, A, async (tx) => expect(await count(tx, "select 1 from public.order_economics")).toBe(0));
    await asUser(db, S, async (tx) => {
      expect(await count(tx, "select 1 from public.order_economics")).toBe(1);
      expect(await count(tx, "select 1 from public.ra_subscriptions")).toBe(2);
    });
  });

  it("anonymous visitors get nothing", async () => {
    for (const t of ["ra_subscriptions", "provider_orders", "service_documents", "order_economics", "bundle_filing_periods"]) {
      await expect(asAnon(db, (tx) => tx.query(`select 1 from public.${t}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("customers can't write service records, even their own", async () => {
    expect(await expectDenied(asUser(db, A, (tx) => tx.query("update public.ra_subscriptions set billing_status = 'active' where id = $1", [aSub])))).toMatch(/permission denied/);
    expect(
      await expectDenied(asUser(db, A, (tx) => tx.query("update public.service_documents set visible_to_customer = false where id = $1", [aDoc]))),
    ).toMatch(/permission denied/);
    expect(
      await expectDenied(asUser(db, A, (tx) => tx.query("select public.transition_provider_order($1, 'payment_confirmed', null, 'customer')", [aProviderOrder]))),
    ).toMatch(/permission denied/);
  });

  it("hidden documents stay hidden from the customer", async () => {
    await db.query("update public.service_documents set visible_to_customer = false where id = $1", [aDoc]);
    await asUser(db, A, async (tx) => expect(await count(tx, "select 1 from public.service_documents")).toBe(0));
    await db.query("update public.service_documents set visible_to_customer = true where id = $1", [aDoc]);
  });
});

describe("payment never activates service", () => {
  it("an appointment can't be marked active without a confirmation date and evidence", async () => {
    expect(await expectDenied(db.query("update public.ra_subscriptions set service_status = 'active' where id = $1", [aSub]))).toMatch(/active_needs_evidence/);
  });

  it("provider order status changes only through the transition function", async () => {
    expect(await expectDenied(db.query("update public.provider_orders set status = 'payment_confirmed' where id = $1", [aProviderOrder]))).toMatch(
      /transition_provider_order/,
    );
  });

  it("refuses skipped steps, a submission without a reference and activation without evidence", async () => {
    expect(await expectDenied(move(aProviderOrder, "active"))).toMatch(/not allowed/);
    await move(aProviderOrder, "payment_confirmed");
    await move(aProviderOrder, "ready_for_provider");
    expect(await expectDenied(move(aProviderOrder, "submitted_to_provider"))).toMatch(/submitted_has_reference/);
    await move(aProviderOrder, "submitted_to_provider", { provider_reference: "RAI-1001" });
    expect(await expectDenied(move(aProviderOrder, "active"))).toMatch(/done_needs_evidence/);
    expect(await expectDenied(move(aProviderOrder, "completed", { confirmed_on: "2026-11-04", evidence: "x" }))).toMatch(/completed_is_filing/);
    expect(await expectDenied(move(aProviderOrder, "processing", { status: "active" }))).toMatch(/patch key status/);
    const r = await move(aProviderOrder, "active", { confirmed_on: "2026-11-04", evidence: "Provider confirmation email" });
    expect(r.rows[0]).toEqual({ status: "active" });
  });

  it("writes an append-only history with each move", async () => {
    expect(await count(db, "select 1 from public.provider_order_events where provider_order_id = $1", [aProviderOrder])).toBe(4);
    expect(await expectDenied(db.query("delete from public.provider_order_events where provider_order_id = $1", [aProviderOrder]))).toMatch(/append-only|not allowed|immutable/i);
    await asUser(db, A, async (tx) => expect(await count(tx, "select 1 from public.provider_order_events")).toBe(4));
  });
});

describe("records stay consistent", () => {
  it("allows one open registered agent service per business and state", async () => {
    expect(await expectDenied(subscription(A, aBusiness, aOrder))).toMatch(/one_open_per_business_state/);
  });

  it("validates the contact phone", async () => {
    expect(await expectDenied(db.query("update public.ra_subscriptions set contact_phone = 'call me' where id = $1", [aSub]))).toMatch(/contact_phone/);
  });

  it("only regular mail can be billed", async () => {
    expect(await expectDenied(db.query("update public.service_documents set billable_mail = true where id = $1", [aDoc]))).toMatch(/billable_is_regular_mail/);
  });

  it("a bundle includes a reporting year and an annual report only once", async () => {
    const insert = (start: string, end: string, year: number | null, req: string | null, status = "scheduled") =>
      db.query(
        `insert into public.bundle_filing_periods (ra_subscription_id, user_id, business_id, period_start, period_end, reporting_year, requirement_id, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [aSub, A, aBusiness, start, end, year, req, status],
      );
    await insert("2026-11-01", "2027-11-01", 2026, aRequirement);
    expect(await expectDenied(insert("2027-11-01", "2028-11-01", 2026, null))).toMatch(/one_per_year/);
    expect(await expectDenied(insert("2027-11-01", "2028-11-01", 2027, aRequirement))).toMatch(/one_per_requirement/);
    expect(await expectDenied(insert("2027-11-01", "2028-11-01", null, null))).toMatch(/included_has_year/);
    expect(await expectDenied(insert("2028-11-01", "2027-11-01", 2028, null))).toMatch(/period_order/);
    // A year with no report is recorded as not included, which needs no reporting year.
    await insert("2027-11-01", "2028-11-01", null, null, "not_included");
  });
});
