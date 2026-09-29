import { beforeAll, describe, expect, it } from "vitest";
import { canTransition, FILING_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
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
  makeStaff,
  pgTextArray,
  ruleVersionId,
  transition,
  walk,
} from "./harness";

let db: Db;
let owner: string;
let staff: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await createUser(db);
  staff = await createUser(db);
  await makeStaff(db, staff, "operator");
});

const newFiling = () => createFilingFixture(db, owner, { legalName: "Status Test LLC" });

describe("status map parity (SQL vs TypeScript)", () => {
  it("filing_transition_allowed() agrees with canTransition() on every (from, to) pair", async () => {
    const res = await db.query<{ f: FilingStatus; t: FilingStatus; ok: boolean }>(
      "select f, t, public.filing_transition_allowed(f, t) as ok from unnest($1::text[]) f cross join unnest($1::text[]) t",
      [pgTextArray(FILING_STATUSES)],
    );
    expect(res.rows).toHaveLength(FILING_STATUSES.length ** 2);
    const mismatches = res.rows.filter((r) => r.ok !== canTransition(r.f, r.t)).map((r) => `${r.f} -> ${r.t}`);
    expect(mismatches).toEqual([]);
  });

  it("the SQL status check lists exactly the TypeScript statuses", async () => {
    const res = await db.query<{ def: string }>(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.filings'::regclass and conname = 'filings_status_check'",
    );
    const inSql = [...res.rows[0].def.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).sort();
    expect(inSql).toEqual([...FILING_STATUSES].sort());
  });

  it("unknown statuses are never allowed", async () => {
    const res = await db.query<{ a: boolean; b: boolean }>(
      "select public.filing_transition_allowed('draft', 'paid') as a, public.filing_transition_allowed('paid', 'draft') as b",
    );
    expect(res.rows[0]).toEqual({ a: false, b: false });
  });
});

describe("status changes only through transition_filing()", () => {
  it("rejects a direct status update, even as service_role or the table owner", async () => {
    const f = await newFiling();
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.filings set status = 'ready_for_review' where id = $1", [f.filingId]))),
    ).toMatch(/transition_filing/);
    expect(await expectDenied(db.query("update public.filings set status = 'completed' where id = $1", [f.filingId]))).toMatch(
      /transition_filing/,
    );
    expect(await filingStatus(db, f.filingId)).toBe("draft");
    // Other columns remain writable by the server.
    const ok = await asService(db, (tx) =>
      tx.query("update public.filings set state_confirmation_number = 'X-1' where id = $1", [f.filingId]),
    );
    expect(ok.affectedRows).toBe(1);
  });

  it("rejects inserting a filing in any status other than draft", async () => {
    const f = await newFiling();
    for (const status of ["ready_for_review", "submitted", "completed"]) {
      const msg = await expectDenied(
        asService(db, (tx) =>
          tx.query(
            `insert into public.filings (user_id, business_id, state_code, filing_type_code, rule_version_id, rule_snapshot, period_year, due_date, status)
             values ($1, $2, 'PA', 'annual_report', $3, '{}'::jsonb, 2027, '2027-09-30', $4)`,
            [owner, f.businessId, f.versionId, status],
          ),
        ),
      );
      expect(msg, status).toMatch(/draft status/);
    }
  });

  it("writes filing_status_history and audit_logs in the same call", async () => {
    const f = await newFiling();
    const row = await transition(db, f.filingId, "ready_for_review", {
      actorUserId: staff,
      actorType: "staff",
      note: "Looks complete",
      expectedFrom: "draft",
    });
    expect(row.status).toBe("ready_for_review");

    const history = await db.query(
      "select from_status, to_status, actor_user_id, actor_type, note, customer_visible from public.filing_status_history where filing_id = $1",
      [f.filingId],
    );
    expect(history.rows).toEqual([
      {
        from_status: "draft",
        to_status: "ready_for_review",
        actor_user_id: staff,
        actor_type: "staff",
        note: "Looks complete",
        customer_visible: true,
      },
    ]);
    const audit = await db.query<{ action: string; actor_type: string; before: unknown; after: unknown; entity_id: string }>(
      "select action, actor_type, before, after, entity_id from public.audit_logs where filing_id = $1",
      [f.filingId],
    );
    expect(audit.rows).toEqual([
      {
        action: "filing.status_changed",
        actor_type: "staff",
        before: { status: "draft" },
        after: { status: "ready_for_review" },
        entity_id: f.filingId,
      },
    ]);
  });

  it("raises on a transition the machine does not allow, leaving no trace", async () => {
    const f = await newFiling();
    expect(await expectDenied(transition(db, f.filingId, "submitted"))).toMatch(/not allowed/);
    expect(await expectDenied(transition(db, f.filingId, "draft"))).toMatch(/not allowed/);
    expect(await filingStatus(db, f.filingId)).toBe("draft");
    expect(await count(db, "select 1 from public.filing_status_history where filing_id = $1", [f.filingId])).toBe(0);
    expect(await count(db, "select 1 from public.audit_logs where filing_id = $1", [f.filingId])).toBe(0);
  });

  it("raises when p_expected_from does not match (concurrent change)", async () => {
    const f = await newFiling();
    await transition(db, f.filingId, "ready_for_review");
    expect(await expectDenied(transition(db, f.filingId, "ready_to_file", { expectedFrom: "draft" }))).toMatch(
      /expected draft/,
    );
    expect(await filingStatus(db, f.filingId)).toBe("ready_for_review");
    await transition(db, f.filingId, "ready_to_file", { expectedFrom: "ready_for_review" });
    expect(await filingStatus(db, f.filingId)).toBe("ready_to_file");
  });

  it("rejects an invalid actor type and unknown filings", async () => {
    const f = await newFiling();
    expect(
      await expectDenied(
        asService(db, (tx) => tx.query("select public.transition_filing($1::uuid, 'cancelled', null, 'hacker')", [f.filingId])),
      ),
    ).toMatch(/invalid actor type/);
    expect(await expectDenied(transition(db, "00000000-0000-0000-0000-000000000000", "cancelled"))).toMatch(/not found/);
  });

  it("requires a rejection reason to reject", async () => {
    const f = await newFiling();
    await walk(db, f.filingId, ["ready_for_review", "ready_to_file", "submitted"]);
    expect(await expectDenied(transition(db, f.filingId, "rejected"))).toMatch(/rejection reason/);
    expect(await expectDenied(transition(db, f.filingId, "rejected", { patch: { rejection_reason: "" } }))).toMatch(
      /rejection reason/,
    );
    const row = await transition(db, f.filingId, "rejected", {
      actorUserId: staff,
      actorType: "staff",
      patch: { rejection_reason: "Registered office county missing" },
    });
    expect(row.status).toBe("rejected");
    expect(row.rejection_reason).toBe("Registered office county missing");
  });

  it("rejects patch keys outside the allow-list", async () => {
    const f = await newFiling();
    for (const patch of [{ status: "completed" }, { user_id: owner }, { order_id: null }, { rule_snapshot: {} }, { assigned_to: staff }]) {
      const msg = await expectDenied(transition(db, f.filingId, "ready_for_review", { patch }));
      expect(msg, JSON.stringify(patch)).toMatch(/patch key .* is not allowed/);
    }
    expect(await filingStatus(db, f.filingId)).toBe("draft");
  });

  it("submitting cancels only this requirement's scheduled reminders and records the submission", async () => {
    const f = await newFiling();
    const other = await newFiling();
    const insertReminder = (requirementId: string, businessId: string, offset: number, status: string) =>
      db.query(
        "insert into public.reminders (requirement_id, user_id, business_id, due_date, offset_days, scheduled_for, status) values ($1, $2, $3, '2026-09-30', $4, '2026-09-30'::date + $4::int, $5)",
        [requirementId, owner, businessId, offset, status],
      );
    await insertReminder(f.requirementId, f.businessId, -30, "sent");
    await insertReminder(f.requirementId, f.businessId, -1, "scheduled");
    await insertReminder(f.requirementId, f.businessId, 7, "scheduled");
    await insertReminder(f.requirementId, f.businessId, 30, "skipped");
    await insertReminder(other.requirementId, other.businessId, -1, "scheduled");

    await walk(db, f.filingId, ["ready_for_review", "ready_to_file"]);
    const row = await transition(db, f.filingId, "submitted", { patch: { state_confirmation_number: "PA-2026-0001" } });
    expect(row.state_confirmation_number).toBe("PA-2026-0001");
    expect(row.submitted_at).toBeInstanceOf(Date);

    const reminders = await db.query<{ offset_days: number; status: string; skip_reason: string | null; processed: boolean }>(
      "select offset_days, status, skip_reason, processed_at is not null as processed from public.reminders where requirement_id = $1 order by offset_days",
      [f.requirementId],
    );
    expect(reminders.rows).toEqual([
      { offset_days: -30, status: "sent", skip_reason: null, processed: false },
      { offset_days: -1, status: "cancelled", skip_reason: "filing_submitted", processed: true },
      { offset_days: 7, status: "cancelled", skip_reason: "filing_submitted", processed: true },
      { offset_days: 30, status: "skipped", skip_reason: null, processed: false },
    ]);
    expect(await count(db, "select 1 from public.reminders where requirement_id = $1 and status = 'scheduled'", [other.requirementId])).toBe(1);
  });

  it("accepting marks the requirement filed with us; reopening a completed filing reopens it", async () => {
    const f = await newFiling();
    await walk(db, f.filingId, ["ready_for_review", "ready_to_file", "submitted"]);
    const accepted = await transition(db, f.filingId, "accepted");
    expect(accepted.accepted_at).toBeInstanceOf(Date);
    const req = await db.query<{ status: string; filing_id: string; resolved: boolean }>(
      "select status, filing_id, resolved_at is not null as resolved from public.filing_requirements where id = $1",
      [f.requirementId],
    );
    expect(req.rows[0]).toEqual({ status: "filed_with_us", filing_id: f.filingId, resolved: true });

    const completed = await transition(db, f.filingId, "completed");
    expect(completed.completed_at).toBeInstanceOf(Date);
    const reopened = await transition(db, f.filingId, "ready_for_review", { actorUserId: staff, actorType: "staff" });
    expect(reopened.completed_at).toBeNull();
    const again = await db.query<{ status: string; resolved_at: Date | null }>(
      "select status, resolved_at from public.filing_requirements where id = $1",
      [f.requirementId],
    );
    expect(again.rows[0]).toEqual({ status: "open", resolved_at: null });
  });

  it("refunded is terminal", async () => {
    const f = await newFiling();
    await walk(db, f.filingId, ["cancelled", "refunded"]);
    for (const to of FILING_STATUSES) {
      expect(await expectDenied(transition(db, f.filingId, to)), to).toMatch(/not allowed/);
    }
  });
});

describe("frozen rule snapshot", () => {
  it("allows changing the rule before ordering and freezes it once the filing has an order", async () => {
    const f = await newFiling();
    const { versionId: corpVersion } = await ruleVersionId(db, "PA:annual_report:corporation");
    await asService(db, (tx) =>
      tx.query("update public.filings set rule_snapshot = rule_snapshot || '{\"note\":\"draft edit\"}'::jsonb where id = $1", [f.filingId]),
    );

    await createOrderFixture(db, owner, f.filingId, f.businessId);
    expect(
      await expectDenied(
        asService(db, (tx) => tx.query("update public.filings set rule_snapshot = '{}'::jsonb where id = $1", [f.filingId])),
      ),
    ).toMatch(/frozen/);
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.filings set rule_version_id = $1 where id = $2", [corpVersion, f.filingId]))),
    ).toMatch(/frozen/);
    const snap = await db.query<{ note: string }>("select rule_snapshot ->> 'note' as note from public.filings where id = $1", [f.filingId]);
    expect(snap.rows[0].note).toBe("draft edit");
  });
});

describe("append-only evidence tables", () => {
  let filingId: string;

  beforeAll(async () => {
    const f = await newFiling();
    filingId = f.filingId;
    await authorize(db, owner, filingId);
    await transition(db, filingId, "ready_for_review", { actorUserId: staff, actorType: "staff" });
  });

  const REWRITE: Record<string, string> = {
    audit_logs: "action = 'nothing.happened'",
    filing_status_history: "note = 'rewritten'",
    filing_authorizations: "signer_name = 'Someone Else'",
  };

  for (const [table, assignment] of Object.entries(REWRITE)) {
    it(`${table} rejects update and delete, even for service_role and the table owner`, async () => {
      expect(await count(db, `select 1 from public.${table} where filing_id = $1`, [filingId])).toBeGreaterThan(0);
      const statements = [
        `update public.${table} set ${assignment} where filing_id = $1`,
        `delete from public.${table} where filing_id = $1`,
      ];
      for (const sql of statements) {
        expect(await expectDenied(asService(db, (tx) => tx.query(sql, [filingId]))), sql).toMatch(/append-only/);
        expect(await expectDenied(db.query(sql, [filingId])), sql).toMatch(/append-only/);
      }
      expect(await count(db, `select 1 from public.${table} where filing_id = $1`, [filingId])).toBeGreaterThan(0);
    });
  }
});

describe("published compliance rule versions", () => {
  async function newVersion(publication: "draft" | "published") {
    const res = await db.query<{ id: string }>(
      `insert into public.state_rule_versions (rule_id, version, verification_status, publication_status, effective_from, filing_name, due_rule, state_fee_cents, content_hash)
       select id, (select coalesce(max(version), 0) + 1 from public.state_rule_versions v where v.rule_id = r.id),
              'verified', $1, '2027-01-01', 'Annual Report', '{"kind":"fixed_annual","month":12,"day":31}'::jsonb, 700, 'hash-' || gen_random_uuid()
       from public.compliance_rules r where rule_key = 'PA:annual_report:business_trust' returning id`,
      [publication],
    );
    const id = res.rows[0].id;
    await db.query(
      "insert into public.state_rule_sources (rule_version_id, fact_key, url, quote, last_verified_at) values ($1, 'due_date', 'https://www.pa.gov/example', 'original quote', now())",
      [id],
    );
    return id;
  }

  it("cannot be modified or deleted", async () => {
    const id = await newVersion("published");
    for (const sql of [
      "update public.state_rule_versions set filing_name = 'Changed' where id = $1",
      "update public.state_rule_versions set state_fee_cents = 0 where id = $1",
      "update public.state_rule_versions set due_rule = '{\"kind\":\"fixed_annual\",\"month\":6,\"day\":30}'::jsonb where id = $1",
    ]) {
      expect(await expectDenied(asService(db, (tx) => tx.query(sql, [id]))), sql).toMatch(/immutable/);
    }
    expect(await expectDenied(asService(db, (tx) => tx.query("delete from public.state_rule_versions where id = $1", [id])))).toMatch(
      /cannot be deleted/,
    );
  });

  it("cannot be moved back to draft (which would make it editable again)", async () => {
    const id = await newVersion("published");
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.state_rule_versions set publication_status = 'draft' where id = $1", [id]))),
    ).toMatch(/cannot return to draft/);
  });

  it("can be superseded, but a superseded version cannot be republished", async () => {
    const id = await newVersion("published");
    await asService(db, (tx) =>
      tx.query("update public.state_rule_versions set publication_status = 'superseded', effective_to = '2027-12-31' where id = $1", [id]),
    );
    const row = await db.query<{ publication_status: string }>("select publication_status from public.state_rule_versions where id = $1", [id]);
    expect(row.rows[0].publication_status).toBe("superseded");
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.state_rule_versions set publication_status = 'published' where id = $1", [id]))),
    ).toMatch(/cannot be republished/);
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.state_rule_versions set filing_name = 'x' where id = $1", [id]))),
    ).toMatch(/immutable/);
  });

  it("drafts stay editable and deletable until published", async () => {
    const id = await newVersion("draft");
    await asService(db, async (tx) => {
      await tx.query("update public.state_rule_versions set filing_name = 'Annual Report (revised)' where id = $1", [id]);
      await tx.query("update public.state_rule_sources set quote = 'corrected quote' where rule_version_id = $1", [id]);
      await tx.query("update public.state_rule_versions set publication_status = 'published' where id = $1", [id]);
    });
    expect(
      await expectDenied(asService(db, (tx) => tx.query("update public.state_rule_versions set filing_name = 'y' where id = $1", [id]))),
    ).toMatch(/immutable/);

    const disposable = await newVersion("draft");
    await asService(db, async (tx) => {
      await tx.query("delete from public.state_rule_sources where rule_version_id = $1", [disposable]);
      await tx.query("delete from public.state_rule_versions where id = $1", [disposable]);
    });
    expect(await count(db, "select 1 from public.state_rule_versions where id = $1", [disposable])).toBe(0);
  });

  it("sources of published versions are immutable (seeded versions included)", async () => {
    const { versionId } = await ruleVersionId(db, "PA:annual_report:llc");
    for (const id of [versionId, await newVersion("published")]) {
      expect(
        await expectDenied(asService(db, (tx) => tx.query("update public.state_rule_sources set quote = 'edited' where rule_version_id = $1", [id]))),
      ).toMatch(/immutable/);
      expect(
        await expectDenied(asService(db, (tx) => tx.query("delete from public.state_rule_sources where rule_version_id = $1", [id]))),
      ).toMatch(/immutable/);
    }
  });
});
