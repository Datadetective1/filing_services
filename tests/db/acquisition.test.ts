import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, count, createTestDb, createUser, type Db, expectDenied } from "./harness";

/** 20261001000011 organic acquisition: service-role only tables, consent rows, new events. */

let db: Db;
let user: string;

const TABLES = ["reminder_subscribers", "reminder_suppressions", "subscriber_reminders", "business_attribution", "founder_prospects", "referral_partners"];

const insertSubscriber = (email: string, entity: string | null, name = "Daff Partners LP") =>
  asService(db, (tx) =>
    tx.query<{ id: string }>(
      "insert into public.reminder_subscribers (email, state_code, entity_type, legal_name, entity_number, consent_text) values ($1, 'PA', 'lp', $2, $3, 'Yes, email me reminders about this business.') returning id",
      [email, name, entity],
    ),
  );

beforeAll(async () => {
  db = await createTestDb();
  user = await createUser(db);
}, 60_000);

describe("acquisition tables are service-role only", () => {
  it.each(TABLES)("%s is hidden from anon and signed-in users", async (t) => {
    await expectDenied(asAnon(db, (tx) => tx.query(`select * from public.${t}`)));
    await expectDenied(asUser(db, user, (tx) => tx.query(`select * from public.${t}`)));
  });

  it("signed-in users cannot add a reminder subscription or attribution directly", async () => {
    await expectDenied(
      asUser(db, user, (tx) =>
        tx.query("insert into public.reminder_subscribers (email, state_code, entity_type, legal_name, consent_text) values ('a@b.co', 'PA', 'lp', 'X', 'consent text here')"),
      ),
    );
  });
});

describe("reminder subscriptions", () => {
  it("stores the consent and keeps one row per email and business", async () => {
    const a = await insertSubscriber("owner@example.test", "0007000001");
    expect(a.rows[0].id).toBeTruthy();
    await expect(insertSubscriber("owner@example.test", "0007000001")).rejects.toThrow();
    // Without an entity number the legal name (case-insensitive) identifies the business.
    await insertSubscriber("owner@example.test", null, "Hand Typed LP");
    await expect(insertSubscriber("owner@example.test", null, "hand typed lp")).rejects.toThrow();
  });

  it("rejects mixed-case emails, unknown statuses and missing consent", async () => {
    await expect(insertSubscriber("Owner@Example.test", "0007000002")).rejects.toThrow();
    await expect(
      asService(db, (tx) =>
        tx.query("insert into public.reminder_subscribers (email, state_code, entity_type, legal_name, consent_text, status) values ('x@example.test', 'PA', 'lp', 'X', 'consent text here', 'subscribed')"),
      ),
    ).rejects.toThrow();
    await expect(
      asService(db, (tx) => tx.query("insert into public.reminder_subscribers (email, state_code, entity_type, legal_name, consent_text) values ('y@example.test', 'PA', 'lp', 'X', '')")),
    ).rejects.toThrow();
  });

  it("plans each reminder once per subscriber, due date and offset", async () => {
    const s = await insertSubscriber("once@example.test", "0007000003");
    const id = s.rows[0].id;
    const ins = () =>
      asService(db, (tx) =>
        tx.query("insert into public.subscriber_reminders (subscriber_id, due_date, offset_days, scheduled_for) values ($1, '2026-12-31', -30, '2026-12-01') on conflict do nothing", [id]),
      );
    await ins();
    await ins();
    expect(await count(db, "select count(*) from public.subscriber_reminders where subscriber_id = $1", [id])).toBe(1);
  });

  it("suppressions are keyed by email", async () => {
    await asService(db, (tx) => tx.query("insert into public.reminder_suppressions (email, reason) values ('gone@example.test', 'unsubscribe')"));
    await expect(asService(db, (tx) => tx.query("insert into public.reminder_suppressions (email, reason) values ('gone@example.test', 'unsubscribe')"))).rejects.toThrow();
  });
});

describe("analytics events", () => {
  it.each(["visit_started", "reminder_opt_in", "reminder_confirmed", "reminder_unsubscribed", "reminder_sent"])("accepts %s", async (e) => {
    await asService(db, (tx) => tx.query("insert into public.analytics_events (event_name, properties) values ($1, '{\"lt_source\":\"google\"}')", [e]));
  });

  it("still rejects unknown events", async () => {
    await expect(asService(db, (tx) => tx.query("insert into public.analytics_events (event_name) values ('page_spam')"))).rejects.toThrow();
  });
});

describe("referral partners and founder research", () => {
  it("referral codes are unique and lowercase", async () => {
    await asService(db, (tx) => tx.query("insert into public.referral_partners (firm_name, kind, ref_code) values ('Smith CPA', 'accountant', 'smith-cpa')"));
    await expect(asService(db, (tx) => tx.query("insert into public.referral_partners (firm_name, kind, ref_code) values ('Other', 'accountant', 'smith-cpa')"))).rejects.toThrow();
    await expect(asService(db, (tx) => tx.query("insert into public.referral_partners (firm_name, kind, ref_code) values ('Caps', 'accountant', 'Smith')"))).rejects.toThrow();
  });

  it("a register record appears on the research list at most once", async () => {
    const rec = await asService(db, (tx) =>
      tx.query<{ id: string }>("insert into public.state_entity_records (state_code, entity_number, legal_name, source, retrieved_at) values ('PA', '0007100001', 'Y LP', 'pa_dos_open_data', now()) returning id"),
    );
    const ins = (d: string) => asService(db, (tx) => tx.query("insert into public.founder_prospects (state_entity_record_id, list_date) values ($1, $2)", [rec.rows[0].id, d]));
    await ins("2026-10-01");
    await expect(ins("2026-10-02")).rejects.toThrow();
  });
});
