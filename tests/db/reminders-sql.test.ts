import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_OFFSETS, planReminders } from "@/lib/domain/reminders";
import { asService, count, createFilingFixture, createTestDb, createUser, type Db, expectDenied, transition, walk } from "./harness";

let db: Db;
let owner: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
});

type Fixture = Awaited<ReturnType<typeof createFilingFixture>>;

function insertReminder(
  f: Pick<Fixture, "requirementId" | "businessId">,
  r: { dueDate?: string; offset: number; scheduledFor: string; status?: string; channel?: string; skipReason?: string | null },
  onConflictDoNothing = false,
) {
  return db.query(
    `insert into public.reminders (requirement_id, user_id, business_id, due_date, offset_days, scheduled_for, status, channel, skip_reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)${onConflictDoNothing ? " on conflict (requirement_id, due_date, offset_days, channel) do nothing" : ""}`,
    [
      f.requirementId,
      owner,
      f.businessId,
      r.dueDate ?? "2026-09-30",
      r.offset,
      r.scheduledFor,
      r.status ?? "scheduled",
      r.channel ?? "email",
      r.skipReason ?? null,
    ],
  );
}

describe("reminder planning rows", () => {
  it("the unique constraint prevents duplicate planning rows", async () => {
    const f = await createFilingFixture(db, owner);
    await insertReminder(f, { offset: -30, scheduledFor: "2026-08-31" });
    expect(await expectDenied(insertReminder(f, { offset: -30, scheduledFor: "2026-08-31" }))).toMatch(/duplicate key/);
    const again = await insertReminder(f, { offset: -30, scheduledFor: "2026-08-31" }, true);
    expect(again.affectedRows ?? 0).toBe(0);
    // Different channel, offset or due date are different reminders.
    await insertReminder(f, { offset: -30, scheduledFor: "2026-08-31", channel: "sms" });
    await insertReminder(f, { offset: -14, scheduledFor: "2026-09-16" });
    await insertReminder(f, { offset: -30, scheduledFor: "2027-08-31", dueDate: "2027-09-30" });
    expect(await count(db, "select 1 from public.reminders where requirement_id = $1", [f.requirementId])).toBe(4);
  });

  it("re-planning the same requirement (cron re-run) is a no-op", async () => {
    const f = await createFilingFixture(db, owner, { dueDate: "2027-09-30" });
    const plan = planReminders("2027-09-30", DEFAULT_REMINDER_OFFSETS, "2026-09-27");
    for (let run = 0; run < 2; run++) {
      for (const p of plan) {
        await insertReminder(
          f,
          { dueDate: "2027-09-30", offset: p.offsetDays, scheduledFor: p.scheduledFor, status: p.status, skipReason: p.skipReason ?? null },
          true,
        );
      }
    }
    expect(await count(db, "select 1 from public.reminders where requirement_id = $1", [f.requirementId])).toBe(plan.length);
  });
});

describe("filing progress cancels reminders", () => {
  it("submitting cancels only this requirement's scheduled reminders", async () => {
    const f = await createFilingFixture(db, owner);
    // Next year's requirement for the same business must be untouched.
    const next = await db.query<{ id: string }>(
      "insert into public.filing_requirements (business_id, owner_user_id, rule_id, period_year, due_date) values ($1, $2, $3, 2027, '2027-09-30') returning id",
      [f.businessId, owner, f.ruleId],
    );
    const nextReq = { requirementId: next.rows[0].id, businessId: f.businessId };

    await insertReminder(f, { offset: -60, scheduledFor: "2026-08-01", status: "sent" });
    await insertReminder(f, { offset: -30, scheduledFor: "2026-08-31", status: "skipped", skipReason: "stale" });
    await insertReminder(f, { offset: -14, scheduledFor: "2026-09-16", status: "failed" });
    await insertReminder(f, { offset: -7, scheduledFor: "2026-09-23", status: "cancelled", skipReason: "manual" });
    await insertReminder(f, { offset: -1, scheduledFor: "2026-09-29" });
    await insertReminder(f, { offset: 0, scheduledFor: "2026-09-30" });
    await insertReminder(nextReq, { dueDate: "2027-09-30", offset: -30, scheduledFor: "2027-08-31" });

    await walk(db, f.filingId, ["ready_for_review", "ready_to_file"]);
    // Earlier transitions do not touch reminders.
    expect(await count(db, "select 1 from public.reminders where requirement_id = $1 and status = 'scheduled'", [f.requirementId])).toBe(2);
    await transition(db, f.filingId, "submitted");

    const rows = await db.query<{ offset_days: number; status: string; skip_reason: string | null }>(
      "select offset_days, status, skip_reason from public.reminders where requirement_id = $1 order by offset_days",
      [f.requirementId],
    );
    expect(rows.rows).toEqual([
      { offset_days: -60, status: "sent", skip_reason: null },
      { offset_days: -30, status: "skipped", skip_reason: "stale" },
      { offset_days: -14, status: "failed", skip_reason: null },
      { offset_days: -7, status: "cancelled", skip_reason: "manual" },
      { offset_days: -1, status: "cancelled", skip_reason: "filing_submitted" },
      { offset_days: 0, status: "cancelled", skip_reason: "filing_submitted" },
    ]);
    expect(await count(db, "select 1 from public.reminders where requirement_id = $1 and status = 'scheduled'", [nextReq.requirementId])).toBe(1);

    // A reminder planned later (e.g. by a lagging cron) is closed when the state accepts.
    await insertReminder(f, { offset: 7, scheduledFor: "2026-10-07" });
    await transition(db, f.filingId, "accepted");
    const late = await db.query<{ status: string; skip_reason: string }>(
      "select status, skip_reason from public.reminders where requirement_id = $1 and offset_days = 7",
      [f.requirementId],
    );
    expect(late.rows[0]).toEqual({ status: "cancelled", skip_reason: "filing_accepted" });
  });
});

describe("rate_limit_hit", () => {
  it("returns true until the limit is reached, then false", async () => {
    const results = await asService(db, async (tx) => {
      const out: boolean[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await tx.query<{ ok: boolean }>("select public.rate_limit_hit('login:a@example.test', 3, 3600) as ok");
        out.push(r.rows[0].ok);
      }
      const other = await tx.query<{ ok: boolean }>("select public.rate_limit_hit('login:b@example.test', 3, 3600) as ok");
      out.push(other.rows[0].ok);
      return out;
    });
    expect(results).toEqual([true, true, true, false, false, true]);
    const row = await db.query<{ count: number }>("select count from public.rate_limits where key = 'login:a@example.test'");
    expect(row.rows[0].count).toBe(5);
  });

  it("truncates very long keys so they cannot bloat the table", async () => {
    const prefix = "k".repeat(200);
    const results = await asService(db, async (tx) => {
      const a = await tx.query<{ ok: boolean }>("select public.rate_limit_hit($1, 1, 3600) as ok", [`${prefix}-a`]);
      const b = await tx.query<{ ok: boolean }>("select public.rate_limit_hit($1, 1, 3600) as ok", [`${prefix}-b`]);
      return [a.rows[0].ok, b.rows[0].ok];
    });
    expect(results).toEqual([true, false]);
    expect(await count(db, "select 1 from public.rate_limits where char_length(key) > 200")).toBe(0);
  });
});
