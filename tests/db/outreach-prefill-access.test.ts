import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, count, createFilingFixture, createTestDb, createUser, type Db, expectDenied, makeStaff } from "./harness";

/**
 * Access to the tables added in 20260930000008: registry records and all outreach tables
 * are service-role only; filing_prefill is readable by the filing's owner (and staff),
 * writable only by the service role.
 */

const SERVICE_ONLY = ["state_entity_records", "prospects", "contact_points", "marketing_suppressions", "marketing_campaigns", "marketing_sends"];

let db: Db;
let owner: string;
let other: string;
let staff: string;
let filingId: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
  other = await createUser(db);
  staff = await createUser(db);
  await makeStaff(db, staff, "operator");
  ({ filingId } = await createFilingFixture(db, owner));
  const rec = await asService(db, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.state_entity_records (state_code, entity_number, legal_name, source, retrieved_at)
       values ('PA', '0007380992', 'Daff Trucking LLC', 'pa_dos_open_data', now()) returning id`,
    ),
  );
  await asService(db, (tx) =>
    tx.query(
      `insert into public.filing_prefill (filing_id, user_id, field_key, source, state_entity_record_id, retrieved_at, original_value)
       values ($1, $2, 'legal_name', 'state_registry', $3, now(), '"Daff Trucking LLC"'::jsonb)`,
      [filingId, owner, rec.rows[0].id],
    ),
  );
  await asService(db, (tx) => tx.query("insert into public.marketing_suppressions (email, reason) values ('owner@example.test', 'unsubscribe')"));
}, 60_000);

describe("service-only tables", () => {
  it("anon and signed-in users (customers and staff) can neither read nor write them", async () => {
    for (const t of SERVICE_ONLY) {
      expect(await expectDenied(asAnon(db, (tx) => tx.query(`select 1 from public.${t}`))), `anon ${t}`).toMatch(/permission denied/);
      expect(await expectDenied(asUser(db, owner, (tx) => tx.query(`select 1 from public.${t}`))), `user ${t}`).toMatch(/permission denied/);
      expect(await expectDenied(asUser(db, staff, (tx) => tx.query(`select 1 from public.${t}`))), `staff ${t}`).toMatch(/permission denied/);
    }
    expect(
      await expectDenied(asUser(db, owner, (tx) => tx.query("delete from public.marketing_suppressions where email = 'owner@example.test'"))),
    ).toMatch(/permission denied/);
  });

  it("the service role can use them", async () => {
    expect(await asService(db, (tx) => count(tx, "select 1 from public.marketing_suppressions"))).toBe(1);
  });

  it("suppression emails must be lower case (one address, one row)", async () => {
    await expect(asService(db, (tx) => tx.query("insert into public.marketing_suppressions (email, reason) values ('Owner@Example.test', 'manual')"))).rejects.toThrow();
  });
});

describe("filing_prefill", () => {
  it("the filing's owner and staff can read it; another customer and anon cannot", async () => {
    expect(await asUser(db, owner, (tx) => count(tx, "select 1 from public.filing_prefill"))).toBe(1);
    expect(await asUser(db, staff, (tx) => count(tx, "select 1 from public.filing_prefill"))).toBe(1);
    expect(await asUser(db, other, (tx) => count(tx, "select 1 from public.filing_prefill"))).toBe(0);
    expect(await expectDenied(asAnon(db, (tx) => tx.query("select 1 from public.filing_prefill")))).toMatch(/permission denied/);
  });

  it("customers cannot write provenance (no forged 'came from the state' claims)", async () => {
    expect(
      await expectDenied(
        asUser(db, owner, (tx) =>
          tx.query(
            `insert into public.filing_prefill (filing_id, user_id, field_key, source, retrieved_at, original_value)
             values ($1, $2, 'governors', 'state_registry', now(), '[]'::jsonb)`,
            [filingId, owner],
          ),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(await expectDenied(asUser(db, owner, (tx) => tx.query("update public.filing_prefill set edited = false")))).toMatch(/permission denied/);
  });
});

describe("analytics events", () => {
  it("accepts the new prefill and outreach event names", async () => {
    for (const e of ["registry_search", "registry_selected", "prefill_applied", "prefill_confirmed", "outreach_clicked"]) {
      await asService(db, (tx) => tx.query("insert into public.analytics_events (event_name) values ($1)", [e]));
    }
    await expect(asService(db, (tx) => tx.query("insert into public.analytics_events (event_name) values ('made_up')"))).rejects.toThrow();
  });
});

describe("mail pilot columns (20261001000009)", () => {
  it("campaigns default to the email channel; mail pilots use the Dec 31 segment and postcard template", async () => {
    const email = await asService(db, (tx) =>
      tx.query<{ channel: string }>("insert into public.marketing_campaigns (name, state_code, segment, subject) values ('e', 'PA', 'unknown_status', 'Reminder: may be due') returning channel"),
    );
    expect(email.rows[0].channel).toBe("email");
    await asService(db, (tx) =>
      tx.query(
        "insert into public.marketing_campaigns (name, state_code, channel, segment, entity_group, template_key, subject) values ('m', 'PA', 'mail', 'upcoming_deadline', 'other', 'pa_dec31_postcard', 'Postcard')",
      ),
    );
    await expect(asService(db, (tx) => tx.query("insert into public.marketing_campaigns (name, state_code, channel, segment, subject) values ('x', 'PA', 'fax', 'unknown_status', 's')"))).rejects.toThrow();
  });

  it("landing codes are unique and well-formed", async () => {
    const rec = await asService(db, (tx) =>
      tx.query<{ id: string }>("insert into public.state_entity_records (state_code, entity_number, legal_name, source, retrieved_at) values ('PA', '0000000001', 'A LP', 'pa_dos_open_data', now()) returning id"),
    );
    const pr = await asService(db, (tx) => tx.query<{ id: string }>("insert into public.prospects (state_entity_record_id, state_code) values ($1, 'PA') returning id", [rec.rows[0].id]));
    const camp = await asService(db, (tx) => tx.query<{ id: string }>("select id from public.marketing_campaigns where channel = 'mail' limit 1"));
    await asService(db, (tx) =>
      tx.query("insert into public.marketing_sends (campaign_id, prospect_id, status, landing_code) values ($1, $2, 'dry_run', 'abcd1234-1-xyzxyzxyz0')", [camp.rows[0].id, pr.rows[0].id]),
    );
    const camp2 = await asService(db, (tx) => tx.query<{ id: string }>("select id from public.marketing_campaigns where channel = 'email' limit 1"));
    await expect(
      asService(db, (tx) =>
        tx.query("insert into public.marketing_sends (campaign_id, prospect_id, status, landing_code) values ($1, $2, 'dry_run', 'abcd1234-1-xyzxyzxyz0')", [camp2.rows[0].id, pr.rows[0].id]),
      ),
    ).rejects.toThrow();
    await expect(
      asService(db, (tx) => tx.query("insert into public.marketing_sends (campaign_id, prospect_id, status, landing_code) values ($1, $2, 'dry_run', 'bad code!')", [camp2.rows[0].id, pr.rows[0].id])),
    ).rejects.toThrow();
  });
});
