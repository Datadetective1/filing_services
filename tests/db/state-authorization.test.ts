import { beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createFilingFixture, createTestDb, createUser, expectDenied, ruleVersionId, type Db } from "./harness";

/**
 * 20261002000013 state authorization: the signed packet, its hash, the rule version, the
 * filing agent, the certification text and the registered-agent consent are stored on the
 * append-only authorization row; a signed agent consent has its own document type.
 */

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

const packet = [
  { section: "Business Information", stateField: "UBI number", answerKey: "entity_number", value: "604 111 222" },
  { section: "Authorized Person", stateField: "Authorized person and certification", answerKey: null, value: "Your own name" },
];

async function signWithPacket(userId: string, filingId: string, versionId: string, consent: unknown = null) {
  return db.query<{ id: string }>(
    `insert into public.filing_authorizations (filing_id, user_id, signer_name, signer_title, attested_accurate, authorized_submission, terms_version,
       authorization_text, answers_sha256, answers_snapshot, rule_version_id, packet_snapshot, packet_sha256, facts_certified, certification_text,
       filing_agent_name, registered_agent_consent)
     values ($1, $2, 'Dana Rivers', 'Member', true, true, 'test.state1', 'text', $3, '{}'::jsonb, $4, $5::jsonb, $6, true,
       'This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct.',
       'Amary Coulibaly, sole proprietor', $7::jsonb) returning id`,
    [filingId, userId, "a".repeat(64), versionId, JSON.stringify(packet), "b".repeat(64), consent === null ? null : JSON.stringify(consent)],
  );
}

describe("filing_authorizations: state-specific columns", () => {
  it("stores the signed packet, hash, rule version, filing agent, certification and consent", async () => {
    const user = await createUser(db);
    const f = await createFilingFixture(db, user);
    const { versionId } = await ruleVersionId(db, "WA:annual_report:llc");
    const consent = { mode: "signer_is_agent", agentName: "Dana Rivers", signerName: "Dana Rivers", signerTitle: "Member", consentText: "I hereby consent…", signedAt: "2026-10-05T10:00:00Z" };
    const row = await signWithPacket(user, f.filingId, versionId, consent);
    const r = await asUser(db, user, (tx) =>
      tx.query<{ packet_snapshot: typeof packet; facts_certified: boolean; filing_agent_name: string; registered_agent_consent: { mode: string }; rule_version_id: string }>(
        "select packet_snapshot, facts_certified, filing_agent_name, registered_agent_consent, rule_version_id from public.filing_authorizations where id = $1",
        [row.rows[0].id],
      ),
    );
    // The customer can read back exactly what they signed (RLS: own rows).
    expect(r.rows[0].packet_snapshot).toEqual(packet);
    expect(r.rows[0].facts_certified).toBe(true);
    expect(r.rows[0].filing_agent_name).toBe("Amary Coulibaly, sole proprietor");
    expect(r.rows[0].registered_agent_consent.mode).toBe("signer_is_agent");
    expect(r.rows[0].rule_version_id).toBe(versionId);
  });

  it("stays append-only: a signed packet can never be edited or deleted", async () => {
    const user = await createUser(db);
    const f = await createFilingFixture(db, user);
    const { versionId } = await ruleVersionId(db, "WA:annual_report:llc");
    const row = await signWithPacket(user, f.filingId, versionId);
    await expectDenied(asService(db, (tx) => tx.query("update public.filing_authorizations set packet_snapshot = '[]'::jsonb where id = $1", [row.rows[0].id])));
    await expectDenied(asService(db, (tx) => tx.query("delete from public.filing_authorizations where id = $1", [row.rows[0].id])));
  });

  it("rejects a malformed packet hash", async () => {
    const user = await createUser(db);
    const f = await createFilingFixture(db, user);
    await expect(
      db.query(
        `insert into public.filing_authorizations (filing_id, user_id, signer_name, signer_title, attested_accurate, authorized_submission, terms_version, authorization_text, answers_sha256, answers_snapshot, packet_sha256)
         values ($1, $2, 'Dana Rivers', 'Member', true, true, 'test', 'text', $3, '{}'::jsonb, 'not-a-hash')`,
        [f.filingId, user, "a".repeat(64)],
      ),
    ).rejects.toThrow();
  });
});

describe("filing_documents: registered agent consent", () => {
  it("accepts the registered_agent_consent kind and still rejects unknown kinds", async () => {
    const user = await createUser(db);
    const f = await createFilingFixture(db, user);
    const insert = (kind: string, path: string) =>
      asService(db, (tx) =>
        tx.query(
          `insert into public.filing_documents (filing_id, user_id, kind, storage_path, file_name, mime_type, size_bytes, sha256, visible_to_customer)
           values ($1, $2, $3, $4, 'consent.pdf', 'application/pdf', 1000, $5, false)`,
          [f.filingId, user, kind, path, "c".repeat(64)],
        ),
      );
    await insert("registered_agent_consent", `${user}/${f.filingId}/consent.pdf`);
    await expect(insert("made_up_kind", `${user}/${f.filingId}/x.pdf`)).rejects.toThrow();
  });
});
