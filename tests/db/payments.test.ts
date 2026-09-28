import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  asService,
  authorize,
  count,
  createFilingFixture,
  createOrderFixture,
  createTestDb,
  createUser,
  type Db,
  expectDenied,
  filingStatus,
} from "./harness";

/**
 * Payment state machine in SQL. Webhooks may arrive twice, late, or out of order;
 * the functions must be idempotent and never move a payment backwards.
 */

let db: Db;
let owner: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
});

type Result = { applied: boolean; reason?: string; newly_paid?: boolean; order_id?: string; filing_id?: string; user_id?: string };

async function paid(opts: { authorized?: boolean; complete?: boolean } = {}) {
  const f = await createFilingFixture(db, owner, { legalName: "Pay Test LLC" });
  if (opts.complete === false) await db.query("update public.filing_answers set is_complete = false where filing_id = $1", [f.filingId]);
  if (opts.authorized !== false) await authorize(db, owner, f.filingId);
  const o = await createOrderFixture(db, owner, f.filingId, f.businessId);
  return { ...f, ...o };
}

async function success(paymentId: string, amount: number | null = 5600, currency: string | null = "usd", eventAt = new Date()) {
  const res = await asService(db, (tx) =>
    tx.query<{ r: Result }>("select public.apply_payment_success($1::uuid, $2, $3, $4::int, $5, $6::timestamptz) as r", [
      paymentId,
      `pi_${paymentId.slice(0, 8)}`,
      "https://sandbox.example/receipt",
      amount,
      currency,
      eventAt.toISOString(),
    ]),
  );
  return res.rows[0].r;
}

async function failure(paymentId: string, status: "failed" | "expired", reason = "card_declined") {
  const res = await asService(db, (tx) =>
    tx.query<{ r: Result }>("select public.apply_payment_failure($1::uuid, $2, $3, now()) as r", [paymentId, status, reason]),
  );
  return res.rows[0].r;
}

async function refundResult(refundId: string, status: "succeeded" | "failed", providerRefundId: string | null = `re_${refundId.slice(0, 8)}`) {
  const res = await asService(db, (tx) =>
    tx.query<{ r: Result }>("select public.apply_refund_result($1::uuid, $2, $3) as r", [refundId, status, providerRefundId]),
  );
  return res.rows[0].r;
}

async function paymentRow(paymentId: string) {
  const res = await db.query<{
    status: string;
    amount_refunded_cents: number;
    requires_review: boolean;
    review_reason: string | null;
    failure_reason: string | null;
    provider_payment_id: string | null;
    receipt_url: string | null;
  }>(
    "select status, amount_refunded_cents, requires_review, review_reason, failure_reason, provider_payment_id, receipt_url from public.payments where id = $1",
    [paymentId],
  );
  return res.rows[0];
}

async function orderRow(orderId: string) {
  const res = await db.query<{ status: string; paid_at: Date | null }>("select status, paid_at from public.orders where id = $1", [orderId]);
  return res.rows[0];
}

const paymentTransitions = (filingId: string) =>
  count(db, "select 1 from public.filing_status_history where filing_id = $1 and note = 'Payment received'", [filingId]);

async function createRefund(p: { paymentId: string; orderId: string }, gov: number, svc: number) {
  const res = await db.query<{ id: string }>(
    "insert into public.refunds (payment_id, order_id, user_id, amount_cents, government_fee_cents, service_fee_cents, reason) values ($1, $2, $3, $4, $5, $6, 'Customer request') returning id",
    [p.paymentId, p.orderId, owner, gov + svc, gov, svc],
  );
  return res.rows[0].id;
}

describe("apply_payment_success", () => {
  it("marks the payment and order paid and moves a complete, authorized draft to ready_for_review", async () => {
    const p = await paid();
    const r = await success(p.paymentId);
    expect(r).toEqual({ applied: true, newly_paid: true, order_id: p.orderId, filing_id: p.filingId, user_id: owner });

    const pay = await paymentRow(p.paymentId);
    expect(pay).toMatchObject({ status: "succeeded", requires_review: false, receipt_url: "https://sandbox.example/receipt" });
    expect(pay.provider_payment_id).toMatch(/^pi_/);
    const order = await orderRow(p.orderId);
    expect(order.status).toBe("paid");
    expect(order.paid_at).toBeInstanceOf(Date);
    expect(await filingStatus(db, p.filingId)).toBe("ready_for_review");

    const history = await db.query("select from_status, to_status, actor_type, actor_user_id from public.filing_status_history where filing_id = $1", [
      p.filingId,
    ]);
    expect(history.rows).toEqual([{ from_status: "draft", to_status: "ready_for_review", actor_type: "system", actor_user_id: null }]);
    expect(await count(db, "select 1 from public.audit_logs where action = 'order.paid' and entity_id = $1", [p.orderId])).toBe(1);
    const req = await db.query<{ filing_id: string }>("select filing_id from public.filing_requirements where id = $1", [p.requirementId]);
    expect(req.rows[0].filing_id).toBe(p.filingId);
  });

  it("moves the filing to needs_information when intake is incomplete or unauthorized", async () => {
    const noAuth = await paid({ authorized: false });
    expect((await success(noAuth.paymentId)).applied).toBe(true);
    expect(await filingStatus(db, noAuth.filingId)).toBe("needs_information");

    const incomplete = await paid({ complete: false });
    expect((await success(incomplete.paymentId)).applied).toBe(true);
    expect(await filingStatus(db, incomplete.filingId)).toBe("needs_information");
  });

  it("is idempotent under duplicate delivery", async () => {
    const p = await paid();
    const first = await success(p.paymentId);
    const paidAt = (await orderRow(p.orderId)).paid_at;
    const second = await success(p.paymentId);
    expect(first.newly_paid).toBe(true);
    expect(second).toMatchObject({ applied: true, newly_paid: false, order_id: p.orderId });
    expect(await paymentTransitions(p.filingId)).toBe(1);
    expect(await count(db, "select 1 from public.audit_logs where action = 'order.paid' and entity_id = $1", [p.orderId])).toBe(1);
    expect((await orderRow(p.orderId)).paid_at).toEqual(paidAt);
    expect(await filingStatus(db, p.filingId)).toBe("ready_for_review");
  });

  it("does not apply an event whose amount differs from the order total", async () => {
    for (const amount of [100, 5599, 5601, null]) {
      const p = await paid();
      const r = await success(p.paymentId, amount);
      expect(r, String(amount)).toEqual({ applied: false, reason: "amount_mismatch" });
      const pay = await paymentRow(p.paymentId);
      expect(pay.status).toBe("pending");
      expect(pay.requires_review).toBe(true);
      expect(pay.review_reason).toMatch(/amount mismatch/);
      expect(await orderRow(p.orderId)).toEqual({ status: "pending_payment", paid_at: null });
      expect(await filingStatus(db, p.filingId)).toBe("draft");
      expect(await count(db, "select 1 from public.audit_logs where action = 'payment.amount_mismatch' and entity_id = $1", [p.paymentId])).toBe(1);
    }
  });

  it("does not apply an event in a different currency", async () => {
    for (const currency of ["eur", "", null]) {
      const p = await paid();
      expect(await success(p.paymentId, 5600, currency), String(currency)).toEqual({ applied: false, reason: "amount_mismatch" });
      expect((await paymentRow(p.paymentId)).status).toBe("pending");
      expect((await orderRow(p.orderId)).status).toBe("pending_payment");
    }
    // Currency codes are compared case-insensitively.
    const p = await paid();
    expect((await success(p.paymentId, 5600, "USD")).applied).toBe(true);
  });

  it("ignores a failure that arrives after success (out of order)", async () => {
    const p = await paid();
    await success(p.paymentId);
    expect(await failure(p.paymentId, "failed")).toEqual({ applied: false, reason: "ignored_out_of_order", current: "succeeded" });
    expect(await failure(p.paymentId, "expired")).toMatchObject({ applied: false, reason: "ignored_out_of_order" });
    expect((await paymentRow(p.paymentId)).status).toBe("succeeded");
    expect((await orderRow(p.orderId)).status).toBe("paid");
    expect(await filingStatus(db, p.filingId)).toBe("ready_for_review");
  });

  it("applies a success that arrives after a failure (customer retried)", async () => {
    const p = await paid();
    expect(await failure(p.paymentId, "failed", "card_declined")).toMatchObject({ applied: true, order_id: p.orderId });
    expect(await paymentRow(p.paymentId)).toMatchObject({ status: "failed", failure_reason: "card_declined" });
    expect((await orderRow(p.orderId)).status).toBe("payment_failed");
    expect(await count(db, "select 1 from public.audit_logs where action = 'payment.failed' and entity_id = $1", [p.paymentId])).toBe(1);

    const r = await success(p.paymentId);
    expect(r).toMatchObject({ applied: true, newly_paid: true });
    expect(await paymentRow(p.paymentId)).toMatchObject({ status: "succeeded", failure_reason: null });
    expect((await orderRow(p.orderId)).status).toBe("paid");
    expect(await filingStatus(db, p.filingId)).toBe("ready_for_review");
  });

  it("expires a pending payment, allows failed -> expired, and never expired -> failed", async () => {
    const p = await paid();
    expect((await failure(p.paymentId, "expired", "session_expired")).applied).toBe(true);
    expect((await paymentRow(p.paymentId)).status).toBe("expired");
    expect((await orderRow(p.orderId)).status).toBe("expired");
    expect(await failure(p.paymentId, "failed")).toMatchObject({ applied: false, reason: "ignored_out_of_order" });
    expect((await paymentRow(p.paymentId)).status).toBe("expired");

    const q = await paid();
    await failure(q.paymentId, "failed");
    expect((await failure(q.paymentId, "expired")).applied).toBe(true);
    expect((await paymentRow(q.paymentId)).status).toBe("expired");
    expect((await orderRow(q.orderId)).status).toBe("expired");

    // A late success for an expired session is still honored (money was taken).
    expect((await success(q.paymentId)).applied).toBe(true);
    expect((await orderRow(q.orderId)).status).toBe("paid");
  });

  it("rejects an unknown failure status and unknown payments", async () => {
    const p = await paid();
    expect(await expectDenied(failure(p.paymentId, "succeeded" as "failed"))).toMatch(/invalid failure status/);
    expect(await expectDenied(success(randomUUID()))).toMatch(/not found/);
    expect(await expectDenied(failure(randomUUID(), "failed"))).toMatch(/not found/);
  });

  it("flags a second, different payment for an already-paid order as a duplicate to refund", async () => {
    const p = await paid();
    // Only one pending payment per order is allowed, so a duplicate arises when the first
    // checkout was superseded (expired in our records) yet the processor still captured it.
    await failure(p.paymentId, "expired");
    const second = await db.query<{ id: string }>(
      "insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id) values ($1, $2, 'sandbox', 'sandbox', 5600, $3) returning id",
      [p.orderId, owner, `sbx_cs_${randomUUID().replace(/-/g, "")}`],
    );
    const secondId = second.rows[0].id;

    await success(p.paymentId);
    const before = await orderRow(p.orderId);
    const r = await success(secondId);
    expect(r).toEqual({ applied: false, reason: "duplicate_payment", order_id: p.orderId });

    const dup = await paymentRow(secondId);
    expect(dup.status).toBe("succeeded");
    expect(dup.requires_review).toBe(true);
    expect(dup.review_reason).toMatch(/duplicate payment/);
    expect(await orderRow(p.orderId)).toEqual(before);
    expect(await paymentTransitions(p.filingId)).toBe(1);
    expect((await paymentRow(p.paymentId)).requires_review).toBe(false);
    expect(await count(db, "select 1 from public.audit_logs where action = 'payment.duplicate' and entity_id = $1", [secondId])).toBe(1);
  });
});

describe("apply_refund_result", () => {
  it("records a partial then a full refund without double counting", async () => {
    const p = await paid();
    await success(p.paymentId);
    const serviceRefund = await createRefund(p, 0, 4900);
    const stateFeeRefund = await createRefund(p, 700, 0);

    expect(await refundResult(serviceRefund, "succeeded")).toMatchObject({ applied: true, order_id: p.orderId, user_id: owner });
    expect(await paymentRow(p.paymentId)).toMatchObject({ status: "partially_refunded", amount_refunded_cents: 4900 });
    expect((await orderRow(p.orderId)).status).toBe("partially_refunded");

    // Duplicate delivery of the same refund result.
    expect(await refundResult(serviceRefund, "succeeded")).toEqual({ applied: false, reason: "already_succeeded" });
    expect((await paymentRow(p.paymentId)).amount_refunded_cents).toBe(4900);

    expect((await refundResult(stateFeeRefund, "succeeded")).applied).toBe(true);
    expect(await paymentRow(p.paymentId)).toMatchObject({ status: "refunded", amount_refunded_cents: 5600 });
    expect((await orderRow(p.orderId)).status).toBe("refunded");
    expect(await refundResult(stateFeeRefund, "succeeded")).toEqual({ applied: false, reason: "already_succeeded" });
    expect((await paymentRow(p.paymentId)).amount_refunded_cents).toBe(5600);

    const refunds = await db.query<{ status: string; provider_refund_id: string }>(
      "select status, provider_refund_id from public.refunds where order_id = $1",
      [p.orderId],
    );
    expect(refunds.rows.every((r) => r.status === "succeeded" && r.provider_refund_id.startsWith("re_"))).toBe(true);
    expect(await count(db, "select 1 from public.audit_logs where action = 'refund.succeeded' and entity_id in ($1, $2)", [serviceRefund, stateFeeRefund])).toBe(2);
  });

  it("a failed refund changes nothing and cannot later be counted", async () => {
    const p = await paid();
    await success(p.paymentId);
    const refund = await createRefund(p, 700, 4900);
    expect((await refundResult(refund, "failed", null)).applied).toBe(true);
    expect(await paymentRow(p.paymentId)).toMatchObject({ status: "succeeded", amount_refunded_cents: 0 });
    expect((await orderRow(p.orderId)).status).toBe("paid");
    expect(await refundResult(refund, "succeeded")).toEqual({ applied: false, reason: "already_failed" });
    expect((await paymentRow(p.paymentId)).amount_refunded_cents).toBe(0);
  });

  it("refunding one of two captured payments (a flagged duplicate) leaves the order paid", async () => {
    const p = await paid();
    // Only one pending payment per order is allowed, so a duplicate arises when the first
    // checkout was superseded (expired in our records) yet the processor still captured it.
    await failure(p.paymentId, "expired");
    const second = await db.query<{ id: string }>(
      "insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id) values ($1, $2, 'sandbox', 'sandbox', 5600, $3) returning id",
      [p.orderId, owner, `sbx_cs_${randomUUID().replace(/-/g, "")}`],
    );
    const duplicate = { paymentId: second.rows[0].id, orderId: p.orderId };
    await success(p.paymentId);
    expect((await success(duplicate.paymentId)).reason).toBe("duplicate_payment");

    // The operator refunds the duplicate in full: the customer still has one full payment captured.
    const dupRefund = await createRefund(duplicate, 700, 4900);
    expect((await refundResult(dupRefund, "succeeded")).applied).toBe(true);
    expect(await paymentRow(duplicate.paymentId)).toMatchObject({ status: "refunded", amount_refunded_cents: 5600 });
    expect((await orderRow(p.orderId)).status).toBe("paid");

    // Refunds of the remaining payment then move the order as usual.
    const partial = await createRefund(p, 0, 4900);
    await refundResult(partial, "succeeded");
    expect((await orderRow(p.orderId)).status).toBe("partially_refunded");
    const rest = await createRefund(p, 700, 0);
    await refundResult(rest, "succeeded");
    expect((await orderRow(p.orderId)).status).toBe("refunded");
  });

  it("refunding the original payment while a duplicate is still captured leaves the order paid", async () => {
    const p = await paid();
    // Only one pending payment per order is allowed, so a duplicate arises when the first
    // checkout was superseded (expired in our records) yet the processor still captured it.
    await failure(p.paymentId, "expired");
    const second = await db.query<{ id: string }>(
      "insert into public.payments (order_id, user_id, provider, mode, amount_cents, provider_session_id) values ($1, $2, 'sandbox', 'sandbox', 5600, $3) returning id",
      [p.orderId, owner, `sbx_cs_${randomUUID().replace(/-/g, "")}`],
    );
    await success(p.paymentId);
    await success(second.rows[0].id);
    // refundFiling() always refunds the oldest captured payment.
    const refund = await createRefund(p, 700, 4900);
    await refundResult(refund, "succeeded");
    expect((await paymentRow(p.paymentId)).status).toBe("refunded");
    expect((await orderRow(p.orderId)).status).toBe("paid");
  });

  it("rejects unknown statuses and refunds", async () => {
    expect(await expectDenied(refundResult(randomUUID(), "pending" as "failed"))).toMatch(/invalid refund status/);
    expect(await expectDenied(refundResult(randomUUID(), "succeeded"))).toMatch(/not found/);
  });
});

describe("money integrity constraints", () => {
  it("a refund amount must equal its government plus service portions", async () => {
    const p = await paid();
    const msg = await expectDenied(
      db.query(
        "insert into public.refunds (payment_id, order_id, user_id, amount_cents, government_fee_cents, service_fee_cents, reason) values ($1, $2, $3, 1000, 700, 200, 'mismatch')",
        [p.paymentId, p.orderId, owner],
      ),
    );
    expect(msg).toMatch(/refunds_amount_is_sum/);
    expect(await expectDenied(createRefund(p, 0, 0))).toMatch(/check constraint/);
  });

  it("an order total must equal the government fee plus the service fee", async () => {
    const p = await paid();
    const msg = await expectDenied(
      db.query(
        "insert into public.orders (user_id, business_id, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode) values ($1, $2, 700, 4900, 4900, '{}'::jsonb, 'sandbox')",
        [owner, p.businessId],
      ),
    );
    expect(msg).toMatch(/orders_total_is_sum/);
    expect(await expectDenied(db.query("update public.orders set service_fee_cents = 0 where id = $1", [p.orderId]))).toMatch(
      /orders_total_is_sum/,
    );
    expect(
      await expectDenied(
        db.query(
          "insert into public.orders (user_id, business_id, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode, currency) values ($1, $2, 700, 4900, 5600, '{}'::jsonb, 'sandbox', 'eur')",
          [owner, p.businessId],
        ),
      ),
    ).toMatch(/check constraint/);
  });

  it("webhook events are unique per provider and event id (replay dedupe)", async () => {
    const insert = () =>
      db.query(
        "insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('sandbox', 'evt_dupe', 'checkout.session.completed', '{}'::jsonb)",
      );
    await insert();
    expect(await expectDenied(insert())).toMatch(/duplicate key/);
    await db.query(
      "insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('stripe', 'evt_dupe', 'checkout.session.completed', '{}'::jsonb)",
    );
  });
});
