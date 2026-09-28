import { randomUUID } from "node:crypto";
import type { Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asService,
  asUser,
  authorize,
  count,
  createFilingFixture,
  createOrderFixture,
  createTestDb,
  createUser,
  type Db,
  expectDenied,
  makeStaff,
  transition,
} from "./harness";

/**
 * Tenant isolation and cross-account attacks, enforced by the database itself.
 * Customer A and customer B each own a full set of rows; staff member S operates.
 * Every "cannot" assertion has a positive control proving the row exists and is
 * reachable by its owner, so a passing test is never vacuous.
 */

const RLS = /row-level security/;
const PERMISSION = /permission denied/;
const SHA = "b".repeat(64);

type Fixture = Awaited<ReturnType<typeof createFilingFixture>>;
type Order = Awaited<ReturnType<typeof createOrderFixture>>;

let db: Db;
let A: string;
let B: string;
let S: string;
let fa: Fixture; // A's paid filing (moved to ready_for_review by payment)
let fa2: Fixture; // A's draft filing (editable intake)
let fa3: Fixture; // A's draft filing with no answers yet
let fb: Fixture; // B's paid filing
let oa: Order;
let ob: Order;
let aHiddenDocId: string;

async function seedTenant(owner: string, f: Fixture, o: Order, label: string) {
  // Customer-writable rows, written as the customer (proves the allowed paths work).
  await asUser(db, owner, async (tx) => {
    await tx.query(
      "insert into public.business_addresses (business_id, kind, line1, city, region, postal_code) values ($1, 'principal_office', '1 Main St', 'Harrisburg', 'PA', '17101')",
      [f.businessId],
    );
    await tx.query(
      "insert into public.business_owners (business_id, full_name, title, role_kind) values ($1, $2, 'Managing Member', 'governor')",
      [f.businessId, `${label} Owner`],
    );
    await tx.query(
      "insert into public.messages (filing_id, user_id, author_id, author_type, body) values ($1, $2, $2, 'customer', 'Hello from the customer')",
      [f.filingId, owner],
    );
  });
  await authorize(db, owner, f.filingId);

  // Server-written rows (the app writes these with the service role).
  await db.query(
    `insert into public.order_items (order_id, filing_id, kind, description, amount_cents) values
       ($1, $2, 'government_fee', 'State fee', 700), ($1, $2, 'service_fee', 'Service fee', 4900)`,
    [o.orderId, f.filingId],
  );
  const res = await asService(db, (tx) =>
    tx.query<{ r: { applied: boolean } }>(
      "select public.apply_payment_success($1, 'pi_test', null, 5600, 'usd', now()) as r",
      [o.paymentId],
    ),
  );
  expect(res.rows[0].r.applied).toBe(true);
  await db.query(
    "insert into public.refunds (payment_id, order_id, user_id, amount_cents, government_fee_cents, service_fee_cents, reason) values ($1, $2, $3, 100, 0, 100, 'Goodwill credit')",
    [o.paymentId, o.orderId, owner],
  );
  const doc = await db.query<{ id: string }>(
    `insert into public.filing_documents (filing_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, visible_to_customer)
     values ($1, $2, 'state_receipt', $3, 'receipt.pdf', 'application/pdf', 1234, $4, true) returning id`,
    [f.filingId, owner, `${owner}/${f.filingId}/${randomUUID()}-receipt.pdf`, SHA],
  );
  const hidden = await db.query<{ id: string }>(
    `insert into public.filing_documents (filing_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, visible_to_customer)
     values ($1, $2, 'filing_packet', $3, 'packet.pdf', 'application/pdf', 1234, $4, false) returning id`,
    [f.filingId, owner, `${owner}/${f.filingId}/${randomUUID()}-packet.pdf`, SHA],
  );
  await db.query(
    "insert into public.filing_receipts (filing_id, user_id, document_id, confirmation_number, state_fee_paid_cents) values ($1, $2, $3, 'PA-123', 700)",
    [f.filingId, owner, doc.rows[0].id],
  );
  await db.query(
    "insert into public.messages (filing_id, user_id, author_id, author_type, body) values ($1, $2, $3, 'staff', 'We are on it')",
    [f.filingId, owner, S],
  );
  await db.query(
    `insert into public.notifications (user_id, business_id, filing_id, template_key, to_address, subject, body_text, body_html)
     values ($1, $2, $3, 'payment_received', 'owner@example.test', 'Payment received', 'Thanks', '<p>Thanks</p>')`,
    [owner, f.businessId, f.filingId],
  );
  await db.query(
    "insert into public.reminders (requirement_id, user_id, business_id, due_date, offset_days, scheduled_for) values ($1, $2, $3, '2026-09-30', -30, '2026-08-31')",
    [f.requirementId, owner, f.businessId],
  );
  // A staff-only status note the customer must not see.
  await db.query(
    "insert into public.filing_status_history (filing_id, from_status, to_status, actor_user_id, actor_type, note, customer_visible) values ($1, 'ready_for_review', 'ready_for_review', $2, 'staff', 'internal', false)",
    [f.filingId, S],
  );
  await db.query("insert into public.admin_notes (filing_id, author_id, body) values ($1, $2, 'Checked the record')", [
    f.filingId,
    S,
  ]);
  await asService(db, (tx) => tx.query("select public.assign_filing($1, $2, $2)", [f.filingId, S]));
  return hidden.rows[0].id;
}

beforeAll(async () => {
  db = await createTestDb();
  A = await createUser(db, "a@example.test");
  B = await createUser(db, "b@example.test");
  S = await createUser(db, "s@example.test");
  await makeStaff(db, S, "operator");

  fa = await createFilingFixture(db, A, { legalName: "Alpha LLC" });
  fa2 = await createFilingFixture(db, A, { legalName: "Alpha Two LLC" });
  fa3 = await createFilingFixture(db, A, { legalName: "Alpha Three LLC" });
  await db.query("delete from public.filing_answers where filing_id = $1", [fa3.filingId]);
  fb = await createFilingFixture(db, B, { legalName: "Beta LLC" });
  oa = await createOrderFixture(db, A, fa.filingId, fa.businessId);
  ob = await createOrderFixture(db, B, fb.filingId, fb.businessId);

  aHiddenDocId = await seedTenant(A, fa, oa, "Alpha");
  await seedTenant(B, fb, ob, "Beta");

  await db.query(
    "insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('sandbox', 'evt_1', 'checkout.session.completed', '{}'::jsonb)",
  );
  await db.query("insert into public.analytics_events (event_name, user_id, path) values ('landing_viewed', $1, '/')", [A]);
  await db.query("insert into public.waitlist (email, state_code) values ('a@example.test', 'NY')");
});

/** A's rows in every tenant table, as (table, filter column, value). */
function aRows(): [table: string, column: string, value: string][] {
  return [
    ["businesses", "id", fa.businessId],
    ["business_addresses", "business_id", fa.businessId],
    ["business_owners", "business_id", fa.businessId],
    ["filing_requirements", "id", fa.requirementId],
    ["filings", "id", fa.filingId],
    ["filing_answers", "filing_id", fa.filingId],
    ["filing_authorizations", "filing_id", fa.filingId],
    ["filing_status_history", "filing_id", fa.filingId],
    ["orders", "id", oa.orderId],
    ["order_items", "order_id", oa.orderId],
    ["payments", "id", oa.paymentId],
    ["refunds", "order_id", oa.orderId],
    ["filing_documents", "filing_id", fa.filingId],
    ["filing_receipts", "filing_id", fa.filingId],
    ["messages", "filing_id", fa.filingId],
    ["notifications", "user_id", A],
    ["reminders", "user_id", A],
  ];
}

const OWNER_COLUMN: Record<string, string> = {
  businesses: "owner_user_id",
  filing_requirements: "owner_user_id",
  filings: "user_id",
  filing_answers: "user_id",
  filing_authorizations: "user_id",
  orders: "user_id",
  payments: "user_id",
  refunds: "user_id",
  filing_documents: "user_id",
  filing_receipts: "user_id",
  messages: "user_id",
  notifications: "user_id",
  reminders: "user_id",
};

const STAFF_ONLY_TABLES = [
  "admin_notes",
  "assignments",
  "audit_logs",
  "payment_events",
  "analytics_events",
  "waitlist",
  "reminder_schedules",
  "notification_templates",
  "sandbox_checkout_sessions",
  "rate_limits",
];

describe("tenant isolation: reads", () => {
  it("the owner can read each of their rows (positive control)", async () => {
    for (const [table, col, value] of aRows()) {
      const n = await asUser(db, A, (tx) => count(tx, `select 1 from public.${table} where ${col} = $1`, [value]));
      expect(n, table).toBeGreaterThan(0);
    }
  });

  it("customer B cannot read any of A's rows", async () => {
    for (const [table, col, value] of aRows()) {
      const n = await asUser(db, B, (tx) => count(tx, `select 1 from public.${table} where ${col} = $1`, [value]));
      expect(n, table).toBe(0);
    }
  });

  it("customer B sees only rows they own, even without a filter", async () => {
    for (const [table, col] of Object.entries(OWNER_COLUMN)) {
      const foreign = await asUser(db, B, (tx) => count(tx, `select 1 from public.${table} where ${col} <> $1`, [B]));
      expect(foreign, table).toBe(0);
      const own = await asUser(db, B, (tx) => count(tx, `select 1 from public.${table}`));
      expect(own, table).toBeGreaterThan(0);
    }
  });

  it("customers cannot see hidden documents or staff-only status notes, even their own", async () => {
    expect(await asUser(db, A, (tx) => count(tx, "select 1 from public.filing_documents where id = $1", [aHiddenDocId]))).toBe(0);
    expect(
      await asUser(db, A, (tx) =>
        count(tx, "select 1 from public.filing_status_history where filing_id = $1 and not customer_visible", [fa.filingId]),
      ),
    ).toBe(0);
    expect(
      await asUser(db, S, (tx) =>
        count(tx, "select 1 from public.filing_status_history where filing_id = $1 and not customer_visible", [fa.filingId]),
      ),
    ).toBe(1);
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.filing_documents where id = $1", [aHiddenDocId]))).toBe(1);
  });

  it("anon can read none of the tenant or staff tables", async () => {
    const tables = [...aRows().map(([t]) => t), ...STAFF_ONLY_TABLES, "profiles", "staff_members"];
    for (const table of tables) {
      expect(await asAnon(db, (tx) => count(tx, `select 1 from public.${table}`)), table).toBe(0);
    }
  });

  it("anon can read public reference data", async () => {
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.states"))).toBe(51);
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.state_agencies"))).toBe(51);
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.filing_types"))).toBeGreaterThan(0);
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.compliance_rules"))).toBe(8);
    expect(
      await asAnon(db, (tx) => count(tx, "select 1 from public.state_rule_versions where publication_status = 'published'")),
    ).toBe(8);
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.state_rule_sources"))).toBeGreaterThan(8);
    expect(await asAnon(db, (tx) => count(tx, "select 1 from public.service_prices where active"))).toBe(1);
  });

  it("anon cannot read draft rule versions, their sources, or inactive prices; staff can", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.state_rule_versions (rule_id, version, verification_status, publication_status, effective_from, filing_name, due_rule, state_fee_cents, content_hash)
       select id, 99, 'unverified', 'draft', '2030-01-01', 'Draft Report', '{"kind":"fixed_annual","month":9,"day":30}'::jsonb, 700, 'draft-hash'
       from public.compliance_rules where rule_key = 'PA:annual_report:llc' returning id`,
    );
    const draftId = rows[0].id;
    await db.query(
      "insert into public.state_rule_sources (rule_version_id, fact_key, url, last_verified_at) values ($1, 'draft_fact', 'https://example.org/draft', now())",
      [draftId],
    );
    await db.query(
      "insert into public.service_prices (filing_type_code, state_code, entity_type, service_fee_cents, active) values ('annual_report', 'PA', 'llc', 1, false)",
    );

    const principals: ((fn: (tx: Transaction) => Promise<number>) => Promise<number>)[] = [
      (fn) => asAnon(db, fn),
      (fn) => asUser(db, B, fn),
    ];
    for (const run of principals) {
      expect(await run((tx) => count(tx, "select 1 from public.state_rule_versions where id = $1", [draftId]))).toBe(0);
      expect(await run((tx) => count(tx, "select 1 from public.state_rule_sources where rule_version_id = $1", [draftId]))).toBe(0);
      expect(await run((tx) => count(tx, "select 1 from public.service_prices where not active"))).toBe(0);
    }
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.state_rule_versions where id = $1", [draftId]))).toBe(1);
    expect(
      await asUser(db, S, (tx) => count(tx, "select 1 from public.state_rule_sources where rule_version_id = $1", [draftId])),
    ).toBe(1);
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.service_prices where not active"))).toBe(1);
  });

  it("customers cannot read staff-only tables or other people's staff records", async () => {
    for (const user of [A, B]) {
      for (const table of STAFF_ONLY_TABLES) {
        expect(await asUser(db, user, (tx) => count(tx, `select 1 from public.${table}`)), table).toBe(0);
      }
      expect(await asUser(db, user, (tx) => count(tx, "select 1 from public.staff_members"))).toBe(0);
    }
    // Positive control: the rows exist and staff can read them.
    for (const table of ["admin_notes", "assignments", "audit_logs", "payment_events", "analytics_events", "waitlist"]) {
      expect(await asUser(db, S, (tx) => count(tx, `select 1 from public.${table}`)), table).toBeGreaterThan(0);
    }
  });

  it("customers cannot read each other's profiles", async () => {
    expect(await asUser(db, B, (tx) => count(tx, "select 1 from public.profiles where id = $1", [A]))).toBe(0);
    expect(await asUser(db, B, (tx) => count(tx, "select 1 from public.profiles where id = $1", [B]))).toBe(1);
  });

  it("staff can read every customer's filings, businesses, answers and audit logs", async () => {
    const filings = await asUser(db, S, (tx) =>
      count(tx, "select 1 from public.filings where id = any($1::uuid[])", [`{${fa.filingId},${fb.filingId}}`]),
    );
    expect(filings).toBe(2);
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.businesses where owner_user_id in ($1, $2)", [A, B]))).toBe(4);
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.filing_answers where filing_id = $1", [fb.filingId]))).toBe(1);
    expect(
      await asUser(db, S, (tx) => count(tx, "select 1 from public.audit_logs where filing_id in ($1, $2)", [fa.filingId, fb.filingId])),
    ).toBeGreaterThanOrEqual(4);
    expect(await asUser(db, S, (tx) => count(tx, "select 1 from public.profiles"))).toBe(3);
  });
});

describe("tenant isolation: writes to another tenant's rows", () => {
  it("B cannot update or delete A's business, addresses, owners or answers", async () => {
    const attempts = [
      ["update public.businesses set legal_name = 'Hacked' where id = $1", fa.businessId],
      ["delete from public.businesses where id = $1", fa.businessId],
      ["update public.business_addresses set line1 = 'Hacked' where business_id = $1", fa.businessId],
      ["delete from public.business_addresses where business_id = $1", fa.businessId],
      ["update public.business_owners set full_name = 'Hacked' where business_id = $1", fa.businessId],
      ["delete from public.business_owners where business_id = $1", fa.businessId],
      ["update public.filing_answers set answers = '{\"legal_name\":\"Hacked\"}'::jsonb where filing_id = $1", fa2.filingId],
      ["delete from public.filing_answers where filing_id = $1", fa2.filingId],
    ] as const;
    for (const [sql, id] of attempts) {
      const res = await asUser(db, B, (tx) => tx.query(sql, [id]));
      expect(res.affectedRows ?? 0, sql).toBe(0);
    }
    const biz = await db.query<{ legal_name: string }>("select legal_name from public.businesses where id = $1", [fa.businessId]);
    expect(biz.rows[0].legal_name).toBe("Alpha LLC");
    expect(await count(db, "select 1 from public.business_addresses where business_id = $1 and line1 = '1 Main St'", [fa.businessId])).toBe(1);
    expect(await count(db, "select 1 from public.business_owners where business_id = $1", [fa.businessId])).toBe(1);
    const ans = await db.query<{ answers: { legal_name: string } }>("select answers from public.filing_answers where filing_id = $1", [
      fa2.filingId,
    ]);
    expect(ans.rows[0].answers.legal_name).toBe("Alpha Two LLC");
  });

  it("the owner can update their own business, address and draft answers (positive control)", async () => {
    await asUser(db, A, async (tx) => {
      expect((await tx.query("update public.businesses set legal_name = 'Alpha Two Renamed LLC' where id = $1", [fa2.businessId])).affectedRows).toBe(1);
      expect((await tx.query("update public.business_addresses set line2 = 'Suite 2' where business_id = $1", [fa.businessId])).affectedRows).toBe(1);
      expect(
        (await tx.query("update public.filing_answers set completed_steps = '{record}' where filing_id = $1", [fa2.filingId])).affectedRows,
      ).toBe(1);
    });
  });

  it("an owner cannot move their rows into another tenant's business", async () => {
    const msg = await expectDenied(
      asUser(db, A, (tx) => tx.query("update public.business_addresses set business_id = $1 where business_id = $2", [fb.businessId, fa.businessId])),
    );
    expect(msg).toMatch(RLS);
    const msg2 = await expectDenied(
      asUser(db, A, (tx) => tx.query("update public.business_owners set business_id = $1 where business_id = $2", [fb.businessId, fa.businessId])),
    );
    expect(msg2).toMatch(RLS);
  });

  it("B cannot create a business owned by A, or rows under A's business", async () => {
    expect(
      await expectDenied(
        asUser(db, B, (tx) =>
          tx.query("insert into public.businesses (owner_user_id, legal_name, state_code, entity_type) values ($1, 'Evil LLC', 'PA', 'llc')", [A]),
        ),
      ),
    ).toMatch(RLS);
    expect(
      await expectDenied(
        asUser(db, B, (tx) =>
          tx.query("insert into public.business_addresses (business_id, kind, line1) values ($1, 'mailing', 'x')", [fa.businessId]),
        ),
      ),
    ).toMatch(RLS);
    expect(
      await expectDenied(
        asUser(db, B, (tx) =>
          tx.query("insert into public.business_owners (business_id, full_name, title, role_kind) values ($1, 'Evil', 'Manager', 'governor')", [
            fa.businessId,
          ]),
        ),
      ),
    ).toMatch(RLS);
  });

  it("B cannot insert intake answers for A's filing", async () => {
    for (const userId of [B, A]) {
      const msg = await expectDenied(
        asUser(db, B, (tx) =>
          tx.query("insert into public.filing_answers (filing_id, user_id, answers) values ($1, $2, '{}'::jsonb)", [fa3.filingId, userId]),
        ),
      );
      expect(msg).toMatch(RLS);
    }
    // Positive control: A can start their own answers.
    await asUser(db, A, (tx) =>
      tx.query("insert into public.filing_answers (filing_id, user_id, answers) values ($1, $2, '{}'::jsonb)", [fa3.filingId, A]),
    );
  });

  it("B cannot post a message on A's filing or impersonate staff on their own filing", async () => {
    const cases: [filingId: string, userId: string, authorId: string, authorType: string][] = [
      [fa.filingId, B, B, "customer"],
      [fa.filingId, A, B, "customer"],
      [fa.filingId, A, A, "customer"],
      [fb.filingId, B, B, "staff"],
      [fb.filingId, B, B, "system"],
      [fb.filingId, B, S, "customer"],
      [fb.filingId, B, S, "staff"],
    ];
    for (const [filingId, userId, authorId, authorType] of cases) {
      const msg = await expectDenied(
        asUser(db, B, (tx) =>
          tx.query("insert into public.messages (filing_id, user_id, author_id, author_type, body) values ($1, $2, $3, $4, 'hi')", [
            filingId,
            userId,
            authorId,
            authorType,
          ]),
        ),
      );
      expect(msg, `${authorType} as ${authorId === S ? "S" : "customer"}`).toMatch(RLS);
    }
    // Positive control.
    await asUser(db, B, (tx) =>
      tx.query("insert into public.messages (filing_id, user_id, author_id, author_type, body) values ($1, $2, $2, 'customer', 'Question')", [
        fb.filingId,
        B,
      ]),
    );
  });

  it("a customer cannot backdate a message or forge read receipts", async () => {
    for (const [column, value] of [
      ["created_at", "2020-01-01T00:00:00Z"],
      ["read_by_staff_at", "2026-09-27T00:00:00Z"],
      ["read_by_customer_at", "2026-09-27T00:00:00Z"],
      ["id", randomUUID()],
    ] as const) {
      const msg = await expectDenied(
        asUser(db, B, (tx) =>
          tx.query(
            `insert into public.messages (filing_id, user_id, author_id, author_type, body, ${column}) values ($1, $2, $2, 'customer', 'Backdated', $3)`,
            [fb.filingId, B, value],
          ),
        ),
      );
      expect(msg, column).toMatch(PERMISSION);
    }
    expect(await count(db, "select 1 from public.messages where body = 'Backdated'")).toBe(0);
  });
});

describe("tables customers can never write", () => {
  it("B cannot insert into money, status, compliance, document or audit tables, even for their own records", async () => {
    const inserts: [label: string, sql: string, params: unknown[]][] = [
      [
        "orders",
        "insert into public.orders (user_id, business_id, government_fee_cents, service_fee_cents, total_cents, pricing_snapshot, payment_mode) values ($1, $2, 0, 0, 0, '{}'::jsonb, 'sandbox')",
        [B, fb.businessId],
      ],
      [
        "payments",
        "insert into public.payments (order_id, user_id, provider, mode, amount_cents, status) values ($1, $2, 'sandbox', 'sandbox', 5600, 'succeeded')",
        [ob.orderId, B],
      ],
      [
        "filings",
        `insert into public.filings (user_id, business_id, state_code, filing_type_code, rule_version_id, rule_snapshot, period_year, due_date)
         values ($1, $2, 'PA', 'annual_report', $3, '{}'::jsonb, 2027, '2027-09-30')`,
        [B, fb.businessId, fb.versionId],
      ],
      [
        "filing_documents",
        "insert into public.filing_documents (filing_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, sha256) values ($1, $2, 'customer_upload', $3, 'x.pdf', 'application/pdf', 10, $4)",
        [fb.filingId, B, `${B}/${randomUUID()}`, SHA],
      ],
      [
        "filing_receipts",
        "insert into public.filing_receipts (filing_id, user_id, confirmation_number) values ($1, $2, 'FAKE')",
        [fb.filingId, B],
      ],
      [
        "audit_logs",
        "insert into public.audit_logs (actor_user_id, actor_type, action, entity_type) values ($1, 'staff', 'filing.status_changed', 'filing')",
        [B],
      ],
      ["staff_members", "insert into public.staff_members (user_id, role) values ($1, 'admin')", [B]],
      [
        "filing_authorizations",
        `insert into public.filing_authorizations (filing_id, user_id, signer_name, signer_title, attested_accurate, authorized_submission, terms_version, authorization_text, answers_sha256, answers_snapshot)
         values ($1, $2, 'Bob Owner', 'Member', true, true, 'v1', 'text', $3, '{}'::jsonb)`,
        [fb.filingId, B, SHA],
      ],
      [
        "filing_status_history",
        "insert into public.filing_status_history (filing_id, from_status, to_status, actor_type) values ($1, 'ready_for_review', 'completed', 'staff')",
        [fb.filingId],
      ],
      [
        "filing_requirements",
        "insert into public.filing_requirements (business_id, owner_user_id, rule_id, period_year, due_date) values ($1, $2, $3, 2030, '2030-09-30')",
        [fb.businessId, B, fb.ruleId],
      ],
      [
        "order_items",
        "insert into public.order_items (order_id, kind, description, amount_cents) values ($1, 'service_fee', 'x', 0)",
        [ob.orderId],
      ],
      [
        "refunds",
        "insert into public.refunds (payment_id, order_id, user_id, amount_cents, service_fee_cents, reason) values ($1, $2, $3, 100, 100, 'give me money')",
        [ob.paymentId, ob.orderId, B],
      ],
      [
        "reminders",
        "insert into public.reminders (requirement_id, user_id, business_id, due_date, offset_days, scheduled_for) values ($1, $2, $3, '2026-09-30', 5, '2026-10-05')",
        [fb.requirementId, B, fb.businessId],
      ],
      [
        "notifications",
        "insert into public.notifications (user_id, template_key, to_address, subject, body_text, body_html) values ($1, 'x', 'b@example.test', 's', 'b', 'b')",
        [B],
      ],
      ["admin_notes", "insert into public.admin_notes (filing_id, author_id, body) values ($1, $2, 'note')", [fb.filingId, B]],
      ["assignments", "insert into public.assignments (filing_id, assigned_to, assigned_by) values ($1, $2, $2)", [fb.filingId, B]],
      [
        "payment_events",
        "insert into public.payment_events (provider, provider_event_id, event_type, payload) values ('sandbox', 'evt_forged', 'checkout.session.completed', '{}'::jsonb)",
        [],
      ],
      ["profiles", "insert into public.profiles (id, email) values ($1, 'x@example.test')", [randomUUID()]],
    ];
    for (const [label, sql, params] of inserts) {
      const msg = await expectDenied(asUser(db, B, (tx) => tx.query(sql, params)));
      expect(msg, label).toMatch(RLS);
    }
  });

  it("B cannot update or delete their own money, status or evidence rows", async () => {
    const attempts: [string, string][] = [
      ["update public.orders set status = 'paid', total_cents = 0, government_fee_cents = 0, service_fee_cents = 0 where id = $1", ob.orderId],
      ["update public.payments set status = 'succeeded', amount_refunded_cents = 0 where id = $1", ob.paymentId],
      ["update public.filings set assigned_to = null where id = $1", fb.filingId],
      ["delete from public.filings where id = $1", fb.filingId],
      ["update public.filing_requirements set status = 'filed_elsewhere' where id = $1", fb.requirementId],
      ["update public.refunds set amount_cents = 5600, service_fee_cents = 5600 where order_id = $1", ob.orderId],
      ["delete from public.filing_documents where filing_id = $1", fb.filingId],
      ["update public.reminders set status = 'cancelled' where requirement_id = $1", fb.requirementId],
      ["update public.notifications set status = 'sent' where filing_id = $1", fb.filingId],
      ["delete from public.messages where filing_id = $1", fb.filingId],
    ];
    for (const [sql, id] of attempts) {
      const res = await asUser(db, B, (tx) => tx.query(sql, [id]));
      expect(res.affectedRows ?? 0, sql).toBe(0);
    }
  });

  it("customers cannot execute the controlled mutation functions", async () => {
    const calls: [string, unknown[]][] = [
      ["select public.transition_filing($1::uuid, 'cancelled', $2::uuid, 'customer')", [fb.filingId, B]],
      ["select public.assign_filing($1::uuid, $2::uuid, $2::uuid)", [fb.filingId, B]],
      ["select public.apply_payment_success($1::uuid, 'pi', null, 5600, 'usd', now())", [ob.paymentId]],
      ["select public.apply_payment_failure($1::uuid, 'failed', 'x', now())", [ob.paymentId]],
      ["select public.apply_refund_result($1::uuid, 'succeeded', 're_1')", [randomUUID()]],
      ["select public.rate_limit_hit($1, 1000, 60)", ["login:b@example.test"]],
    ];
    for (const [sql, params] of calls) {
      expect(await expectDenied(asUser(db, B, (tx) => tx.query(sql, params))), sql).toMatch(PERMISSION);
      expect(await expectDenied(asAnon(db, (tx) => tx.query(sql, params))), sql).toMatch(PERMISSION);
    }
  });
});

describe("profiles, staff and business standing", () => {
  it("a customer can update only their own name, phone and reminder preference", async () => {
    await asUser(db, B, async (tx) => {
      const res = await tx.query(
        "update public.profiles set full_name = 'Bob B', phone = '555-0100', reminder_emails_enabled = false where id = $1",
        [B],
      );
      expect(res.affectedRows).toBe(1);
    });
    const p = await db.query<{ full_name: string; reminder_emails_enabled: boolean }>(
      "select full_name, reminder_emails_enabled from public.profiles where id = $1",
      [B],
    );
    expect(p.rows[0]).toEqual({ full_name: "Bob B", reminder_emails_enabled: false });

    const other = await asUser(db, B, (tx) => tx.query("update public.profiles set full_name = 'Hacked' where id = $1", [A]));
    expect(other.affectedRows ?? 0).toBe(0);
  });

  it("a customer cannot change their profile email or id", async () => {
    expect(
      await expectDenied(asUser(db, B, (tx) => tx.query("update public.profiles set email = 'new@evil.test' where id = $1", [B]))),
    ).toMatch(PERMISSION);
    expect(
      await expectDenied(asUser(db, B, (tx) => tx.query("update public.profiles set id = $1 where id = $2", [A, B]))),
    ).toMatch(PERMISSION);
    const p = await db.query<{ email: string }>("select email from public.profiles where id = $1", [B]);
    expect(p.rows[0].email).toBe("b@example.test");
  });

  it("a customer cannot make themselves staff", async () => {
    expect(
      await expectDenied(asUser(db, B, (tx) => tx.query("insert into public.staff_members (user_id, role) values ($1, 'admin')", [B]))),
    ).toMatch(RLS);
    const isStaff = await asUser(db, B, (tx) => tx.query<{ s: boolean }>("select public.is_staff() as s"));
    expect(isStaff.rows[0].s).toBe(false);
    // Even an operator cannot promote themselves to admin through the API.
    const promote = await asUser(db, S, (tx) => tx.query("update public.staff_members set role = 'admin' where user_id = $1", [S]));
    expect(promote.affectedRows ?? 0).toBe(0);
    const isAdmin = await asUser(db, S, (tx) => tx.query<{ a: boolean; s: boolean }>("select public.is_admin() as a, public.is_staff() as s"));
    expect(isAdmin.rows[0]).toEqual({ a: false, s: true });
  });

  it("a customer cannot claim state-registry standing", async () => {
    expect(
      await expectDenied(
        asUser(db, B, (tx) =>
          tx.query(
            "insert into public.businesses (owner_user_id, legal_name, state_code, entity_type, standing, standing_source) values ($1, 'B2 LLC', 'PA', 'llc', 'active', 'state_registry')",
            [B],
          ),
        ),
      ),
    ).toMatch(RLS);
    expect(
      await expectDenied(
        asUser(db, B, (tx) =>
          tx.query(
            "insert into public.businesses (owner_user_id, legal_name, state_code, entity_type, registry_record) values ($1, 'B3 LLC', 'PA', 'llc', '{\"status\":\"active\"}'::jsonb)",
            [B],
          ),
        ),
      ),
    ).toMatch(RLS);
    for (const sql of [
      "update public.businesses set standing_source = 'state_registry' where id = $1",
      "update public.businesses set standing = 'active' where id = $1",
      "update public.businesses set owner_user_id = auth.uid() where id = $1",
    ]) {
      expect(await expectDenied(asUser(db, B, (tx) => tx.query(sql, [fb.businessId]))), sql).toMatch(PERMISSION);
    }
  });

  it("a customer cannot reassign intake answers to another filing or user", async () => {
    for (const sql of [
      "update public.filing_answers set user_id = auth.uid() where filing_id = $1",
      "update public.filing_answers set filing_id = filing_id where filing_id = $1",
    ]) {
      expect(await expectDenied(asUser(db, A, (tx) => tx.query(sql, [fa2.filingId]))), sql).toMatch(PERMISSION);
    }
  });
});

describe("intake answers freeze once the filing leaves an editable status", () => {
  it("allows edits in draft, blocks them in review, and reopens them when we ask for information", async () => {
    const edit = () =>
      asUser(db, A, (tx) =>
        tx.query("update public.filing_answers set answers = answers || '{\"note\":\"edited\"}'::jsonb where filing_id = $1", [fa2.filingId]),
      );
    expect((await edit()).affectedRows).toBe(1);

    await transition(db, fa2.filingId, "ready_for_review", { expectedFrom: "draft" });
    expect((await edit()).affectedRows ?? 0).toBe(0);

    await transition(db, fa2.filingId, "needs_customer_action", { actorUserId: S, actorType: "staff" });
    expect((await edit()).affectedRows).toBe(1);

    await transition(db, fa2.filingId, "ready_for_review");
    expect((await edit()).affectedRows ?? 0).toBe(0);
    // A new answers row cannot be inserted to get around the freeze either.
    expect(
      await expectDenied(
        asUser(db, A, (tx) =>
          tx.query("insert into public.filing_answers (filing_id, user_id, answers) values ($1, $2, '{}'::jsonb)", [fa.filingId, A]),
        ),
      ),
    ).toMatch(/row-level security|duplicate key/);
  });
});
