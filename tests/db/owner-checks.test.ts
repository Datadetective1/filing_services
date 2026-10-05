import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, createTestDb, createUser, expectDenied, makeStaff, type Db } from "./harness";

/** 20261004000014 owner_checks: service role only (the admin console after requireAdmin). */

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("owner_checks", () => {
  it("the service role can save and update an item", async () => {
    const admin = await createUser(db);
    await asService(db, (tx) =>
      tx.query("insert into public.owner_checks (item_key, done, note, updated_by) values ('wa.row4', true, 'Radio 1: ...', $1)", [admin]),
    );
    await asService(db, (tx) => tx.query("update public.owner_checks set note = 'Radio 1: exact text' where item_key = 'wa.row4'"));
    const r = await asService(db, (tx) => tx.query<{ done: boolean; note: string }>("select done, note from public.owner_checks where item_key = 'wa.row4'"));
    expect(r.rows[0]).toEqual({ done: true, note: "Radio 1: exact text" });
  });

  it("customers, staff sessions and anonymous visitors can't read or write it directly", async () => {
    const customer = await createUser(db);
    const staff = await createUser(db);
    await makeStaff(db, staff, "admin");
    for (const run of [
      (sql: string) => asAnon(db, (tx) => tx.query(sql)),
      (sql: string) => asUser(db, customer, (tx) => tx.query(sql)),
      (sql: string) => asUser(db, staff, (tx) => tx.query(sql)),
    ]) {
      await expectDenied(run("select * from public.owner_checks"));
      await expectDenied(run("insert into public.owner_checks (item_key) values ('nv.call.q1')"));
    }
  });

  it("rejects malformed keys and oversized notes", async () => {
    await expect(asService(db, (tx) => tx.query("insert into public.owner_checks (item_key) values ('Bad Key!')"))).rejects.toThrow();
    await expect(asService(db, (tx) => tx.query("insert into public.owner_checks (item_key, note) values ('ut.call.q1', repeat('x', 4001))"))).rejects.toThrow();
  });
});
