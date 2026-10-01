import { beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createTestDb, createUser, type Db, expectDenied } from "./harness";

/** mark_mail_event (20261001000010): service-role only, selected pieces only, first time wins. */

let db: Db;
let user: string;
let campaignId = "";
let short = "";

beforeAll(async () => {
  db = await createTestDb();
  user = await createUser(db);
  const camp = await asService(db, (tx) =>
    tx.query<{ id: string }>(
      "insert into public.marketing_campaigns (name, state_code, channel, segment, entity_group, template_key, subject) values ('pilot', 'PA', 'mail', 'upcoming_deadline', 'other', 'pa_dec31_postcard', 'Postcard') returning id",
    ),
  );
  campaignId = camp.rows[0].id;
  short = campaignId.replace(/-/g, "").slice(0, 8);
  for (const [num, selected] of [["0007000001", true], ["0007000002", false]] as const) {
    const rec = await asService(db, (tx) =>
      tx.query<{ id: string }>("insert into public.state_entity_records (state_code, entity_number, legal_name, source, retrieved_at) values ('PA', $1, 'X LP', 'pa_dos_open_data', now()) returning id", [num]),
    );
    const pr = await asService(db, (tx) => tx.query<{ id: string }>("insert into public.prospects (state_entity_record_id, state_code) values ($1, 'PA') returning id", [rec.rows[0].id]));
    await asService(db, (tx) => tx.query("insert into public.marketing_sends (campaign_id, prospect_id, status, selected) values ($1, $2, 'dry_run', $3)", [campaignId, pr.rows[0].id, selected]));
  }
}, 60_000);

const row = async (num: string) =>
  (
    await asService(db, (tx) =>
      tx.query<{ clicked_at: string | null; record_viewed_at: string | null }>(
        "select s.clicked_at, s.record_viewed_at from public.marketing_sends s join public.prospects p on p.id = s.prospect_id join public.state_entity_records r on r.id = p.state_entity_record_id where r.entity_number = $1",
        [num],
      ),
    )
  ).rows[0];

describe("mark_mail_event", () => {
  it("records a visit and a record view on a selected piece (entity number without leading zeros)", async () => {
    const n = await asService(db, (tx) => tx.query<{ n: number }>("select public.mark_mail_event($1, '7000001', 'visit') as n", [short]));
    expect(n.rows[0].n).toBe(1);
    const first = await row("0007000001");
    expect(first.clicked_at).not.toBeNull();
    await asService(db, (tx) => tx.query("select public.mark_mail_event($1, '7000001', 'record_viewed')", [short]));
    const second = await row("0007000001");
    expect(second.record_viewed_at).not.toBeNull();
    expect(second.clicked_at).toEqual(first.clicked_at); // first time wins
  });

  it("ignores pieces that aren't selected, other campaigns, and malformed input", async () => {
    await asService(db, (tx) => tx.query("select public.mark_mail_event($1, '7000002', 'visit')", [short]));
    expect((await row("0007000002")).clicked_at).toBeNull();
    for (const [c, e, ev] of [["deadbeef", "7000001", "visit"], [short, "abc", "visit"], [short, "7000001", "paid"], ["x';--", "1", "visit"]]) {
      const r = await asService(db, (tx) => tx.query<{ n: number }>("select public.mark_mail_event($1, $2, $3) as n", [c, e, ev]));
      expect(r.rows[0].n).toBe(0);
    }
  });

  it("cannot be called by signed-in users", async () => {
    expect(await expectDenied(asUser(db, user, (tx) => tx.query("select public.mark_mail_event($1, '7000001', 'visit')", [short])))).toMatch(/permission denied/);
  });
});
