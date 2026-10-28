import { beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, authorize, createFilingFixture, createOrderFixture, createTestDb, createUser, type Db, expectDenied } from "./harness";

/**
 * Clearing a payment's review flag, in real Postgres with the production migrations: the
 * flag comes from the real apply_payment_success guard, a customer cannot clear it, the
 * service role (what "Mark reviewed" uses after requireAdmin) changes only requires_review,
 * and the audit row it writes cannot be altered afterwards.
 */

let db: Db;
let owner: string;
let paymentId: string;

type PaymentRow = Record<string, unknown> & { requires_review: boolean; review_reason: string | null };
const paymentRow = async (id: string) => (await db.query<PaymentRow>("select * from public.payments where id = $1", [id])).rows[0];
const flaggedCount = async () => (await db.query<{ n: number }>("select count(*)::int as n from public.payments where requires_review")).rows[0].n;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
  const f = await createFilingFixture(db, owner, { legalName: "Review Flag LLC" });
  await authorize(db, owner, f.filingId);
  const o = await createOrderFixture(db, owner, f.filingId, f.businessId);
  paymentId = o.paymentId;
  // A success event for the wrong amount: the guard flags the payment instead of applying it.
  const res = await asService(db, (tx) =>
    tx.query<{ r: { applied: boolean; reason?: string } }>("select public.apply_payment_success($1::uuid, 'pi_review', null, 9900, 'usd', now()) as r", [paymentId]),
  );
  expect(res.rows[0].r).toMatchObject({ applied: false, reason: "amount_mismatch" });
});

describe("clearing requires_review", () => {
  it("the payment is flagged with its reason", async () => {
    const p = await paymentRow(paymentId);
    expect(p.requires_review).toBe(true);
    expect(p.review_reason).toMatch(/^amount mismatch: event 9900 usd, order 5600 usd$/);
    expect(await flaggedCount()).toBe(1);
  });

  it("the customer who owns it cannot clear it", async () => {
    // Row-level security: no update policy on payments, so the update matches nothing.
    const res = await asUser(db, owner, (tx) => tx.query("update public.payments set requires_review = false where id = $1", [paymentId]));
    expect(res.affectedRows ?? 0).toBe(0);
    expect((await paymentRow(paymentId)).requires_review).toBe(true);
  });

  it("the service role clears only requires_review; reason, status and amounts stay", async () => {
    const before = await paymentRow(paymentId);
    await asService(db, (tx) =>
      tx.query(
        `insert into public.audit_logs (actor_user_id, actor_type, action, entity_type, entity_id, before, after, metadata)
         values ($1, 'staff', 'payment.review_cleared', 'payment', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
        [
          owner,
          paymentId,
          JSON.stringify({ requires_review: true, review_reason: before.review_reason }),
          JSON.stringify({ requires_review: false, review_reason: before.review_reason }),
          JSON.stringify({ note: "Checked in Stripe: never charged.", order_id: before.order_id }),
        ],
      ),
    );
    const res = await asService(db, (tx) => tx.query("update public.payments set requires_review = false where id = $1 and requires_review", [paymentId]));
    expect(res.affectedRows).toBe(1);

    const after = await paymentRow(paymentId);
    // updated_at is maintained by the payments_updated_at trigger; every other column is unchanged.
    const withoutUpdatedAt = (r: PaymentRow) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "updated_at"));
    expect(withoutUpdatedAt(after)).toEqual({ ...withoutUpdatedAt(before), requires_review: false });
    expect(await flaggedCount()).toBe(0);

    // A second clear matches nothing.
    const again = await asService(db, (tx) => tx.query("update public.payments set requires_review = false where id = $1 and requires_review", [paymentId]));
    expect(again.affectedRows).toBe(0);
  });

  it("the audit row is kept as written: it cannot be edited or deleted", async () => {
    const row = await db.query<{ id: number; metadata: { note: string } }>("select id, metadata from public.audit_logs where action = 'payment.review_cleared' and entity_id = $1", [paymentId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].metadata.note).toBe("Checked in Stripe: never charged.");
    await expectDenied(asService(db, (tx) => tx.query("update public.audit_logs set metadata = '{}'::jsonb where id = $1", [row.rows[0].id])));
    await expectDenied(asService(db, (tx) => tx.query("delete from public.audit_logs where id = $1", [row.rows[0].id])));
  });
});
