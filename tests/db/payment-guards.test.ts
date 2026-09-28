import { beforeAll, describe, expect, it } from "vitest";
import { createFilingFixture, createOrderFixture, createTestDb, createUser, expectDenied, type Db } from "./harness";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
});

describe("payment guards", () => {
  it("allows only one pending payment per order", async () => {
    const user = await createUser(db);
    const { filingId, businessId } = await createFilingFixture(db, user);
    const { orderId } = await createOrderFixture(db, user, filingId, businessId);
    const msg = await expectDenied(
      db.query(
        `insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id)
         values ($1, $2, 'sandbox', 'sandbox', 5600, 'sbx_cs_second')`,
        [orderId, user],
      ),
    );
    expect(msg).toMatch(/payments_one_pending_per_order|duplicate key/);
  });

  it("a new pending payment is allowed once the previous one is expired", async () => {
    const user = await createUser(db);
    const { filingId, businessId } = await createFilingFixture(db, user);
    const { orderId, paymentId } = await createOrderFixture(db, user, filingId, businessId);
    await db.query("select public.apply_payment_failure($1, 'expired', 'superseded', now())", [paymentId]);
    await db.query(
      `insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id)
       values ($1, $2, 'sandbox', 'sandbox', 5600, 'sbx_cs_retry')`,
      [orderId, user],
    );
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.payments where order_id = $1", [orderId]);
    expect(rows[0].n).toBe(2);
  });
});
