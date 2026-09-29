import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stableStringify } from "@/lib/compliance/hash";
import { PENNSYLVANIA_RULES } from "@/lib/compliance/states/pennsylvania";
import type { IntakeSchema } from "@/lib/compliance/types";
import { validateAll, type IntakeAnswers } from "@/lib/intake/validate";

/**
 * Operator safety checks in src/lib/filings/operations.ts. The database, email and
 * storage layers are replaced by in-memory fakes: nothing leaves the process.
 */

const schema: IntakeSchema = PENNSYLVANIA_RULES.find((r) => r.entityType === "llc")!.intake;

function validAnswers(): IntakeAnswers {
  return {
    legal_name: "Keystone Test Bakery LLC",
    entity_number: "0012345",
    jurisdiction_of_formation: "Pennsylvania",
    registered_office: { mode: "address", line1: "100 Market Street", city: "Harrisburg", region: "PA", postal_code: "17101", county: "Dauphin" },
    principal_office: { line1: "200 Chestnut Street", city: "Philadelphia", region: "PA", postal_code: "19106" },
    governors: [{ name: "Dana Whitfield", title: "Managing Member" }],
    principal_officers: [],
    changes_since_last_report: "no",
    state_notice_email: "",
  };
}

/** The exact calculation authorizeFiling records on filing_authorizations.answers_sha256. */
function signedHash(answers: IntakeAnswers): string {
  return createHash("sha256").update(stableStringify(validateAll(schema, answers).values)).digest("hex");
}

// ---------------------------------------------------------------------------
// In-memory fakes
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => ({
  status: "ready_for_review" as string,
  answers: {} as Row,
  isComplete: true,
  authorizationSha: null as string | null,
  order: { status: "paid", payment_mode: "sandbox", government_fee_cents: 700 } as Row | null,
  verification: "verified" as string,
  receiptDocs: 0,
  receiptInsertError: null as { message: string } | null,
  rpcCalls: [] as { fn: string; args: Row }[],
  inserts: [] as { table: string; row: Row }[],
  sends: [] as Row[],
  sendThrows: false,
  provider: "outbox",
}));

function chain(result: () => unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "neq", "order", "limit", "gte", "lte"]) c[m] = () => c;
  c.maybeSingle = async () => result();
  c.single = async () => result();
  c.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
  return c;
}

function tableData(table: string): unknown {
  switch (table) {
    case "filing_answers":
      return { answers: fake.answers, is_complete: fake.isComplete };
    case "filing_authorizations":
      return fake.authorizationSha ? { answers_sha256: fake.authorizationSha } : null;
    case "orders":
      return fake.order;
    case "filings":
      return { status: fake.status, requirement_id: null, user_id: "user-1", state_code: "PA" };
    default:
      return null;
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => chain(() => ({ data: tableData(table), count: table === "filing_documents" ? fake.receiptDocs : 0, error: null })),
      insert: (row: Row) => {
        fake.inserts.push({ table, row });
        const error = table === "filing_receipts" ? fake.receiptInsertError : null;
        return chain(() => ({ data: { id: `${table}-new` }, error }));
      },
      update: () => chain(() => ({ data: null, error: null })),
    }),
    rpc: async (fn: string, args: Row) => {
      fake.rpcCalls.push({ fn, args });
      if (fn === "transition_filing") fake.status = String(args.p_to_status);
      return { data: null, error: null };
    },
  }),
}));

vi.mock("@/lib/filings/context", () => ({
  loadFilingContext: async (id: string) => ({
    filing: {
      id,
      userId: "user-1",
      businessId: "business-1",
      orderId: fake.order ? "order-1" : null,
      requirementId: null,
      status: fake.status,
      stateCode: "PA",
      periodYear: 2026,
      dueDate: "2026-09-30",
      confirmationNumber: null,
      ruleSnapshot: { intake_schema: schema, verification_status: fake.verification, state_fee_cents: 700, filing_name: "Annual Report" },
    },
    businessName: "Keystone Test Bakery LLC",
    stateName: "Pennsylvania",
    filingTitle: "Annual Report",
    vars: { company_name: "Keystone Test Bakery LLC", state_name: "Pennsylvania", filing_title: "Annual Report" },
  }),
}));

vi.mock("@/lib/notifications/send", () => ({
  sendNotification: async (input: Row) => {
    if (fake.sendThrows) throw new Error("Notification claim failed: boom");
    fake.sends.push(input);
    return { status: "sent", notificationId: `n-${fake.sends.length}` };
  },
}));
vi.mock("@/lib/email/provider", () => ({ getEmailProvider: () => ({ name: fake.provider }) }));
vi.mock("@/lib/documents/storage", () => ({
  storeFilingDocument: async () => ({ id: "doc-1", storagePath: "user-1/filing-1/doc-1.pdf", sha256: "a".repeat(64) }),
}));
vi.mock("@/lib/audit", () => ({ audit: async () => {} }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: async () => {} }));
vi.mock("@/lib/reminders/engine", () => ({ rollForwardRequirement: async () => null }));
vi.mock("@/lib/payments/process-event", () => ({ afterRefundSucceeded: async () => {} }));

const ops = await import("@/lib/filings/operations");
const staff = { id: "staff-1", email: "ops@example.com", role: "admin", displayName: "Ops" } as unknown as Parameters<typeof ops.markReadyToFile>[0];
const FILING = "11111111-1111-4111-8111-111111111111";

const transitions = () => fake.rpcCalls.filter((c) => c.fn === "transition_filing").map((c) => c.args.p_to_status);

beforeEach(() => {
  fake.status = "ready_for_review";
  fake.answers = validAnswers();
  fake.isComplete = true;
  fake.authorizationSha = signedHash(validAnswers());
  fake.order = { status: "paid", payment_mode: "sandbox", government_fee_cents: 700 };
  fake.verification = "verified";
  fake.receiptDocs = 0;
  fake.receiptInsertError = null;
  fake.rpcCalls = [];
  fake.inserts = [];
  fake.sends = [];
  fake.sendThrows = false;
  fake.provider = "outbox";
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
});

afterEach(() => {
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
});

// ---------------------------------------------------------------------------

describe("answersSha256", () => {
  it("matches the hash recorded when the customer signs", () => {
    expect(ops.answersSha256(schema, validAnswers())).toBe(signedHash(validAnswers()));
  });
});

describe("readyToFileBlockers", () => {
  const input = (over: Partial<Parameters<typeof ops.readyToFileBlockers>[0]> = {}) => ({
    schema,
    answers: validAnswers(),
    intakeComplete: true,
    authorizationSha256: signedHash(validAnswers()),
    order: { status: "paid", payment_mode: "sandbox" },
    ruleVerificationStatus: "verified",
    production: false,
    ...over,
  });

  it("allows a signed, complete, paid sandbox order outside production (the staging journey)", () => {
    expect(ops.readyToFileBlockers(input())).toEqual([]);
  });

  it("refuses when the answers changed after the customer signed", () => {
    const edited = { ...validAnswers(), entity_number: "7654321" };
    expect(ops.readyToFileBlockers(input({ answers: edited })).join(" ")).toMatch(/changed after they signed/);
  });

  it("refuses when no authorization is recorded", () => {
    expect(ops.readyToFileBlockers(input({ authorizationSha256: null })).join(" ")).toMatch(/No customer authorization/);
  });

  it("refuses incomplete intake, whether flagged or actually invalid", () => {
    expect(ops.readyToFileBlockers(input({ intakeComplete: false })).join(" ")).toMatch(/incomplete/);
    const invalid = { ...validAnswers(), governors: [] };
    expect(ops.readyToFileBlockers(input({ answers: invalid, authorizationSha256: signedHash(invalid) })).join(" ")).toMatch(/incomplete/);
  });

  it("refuses unpaid or missing orders", () => {
    expect(ops.readyToFileBlockers(input({ order: null })).join(" ")).toMatch(/not paid/);
    expect(ops.readyToFileBlockers(input({ order: { status: "pending_payment", payment_mode: "sandbox" } })).join(" ")).toMatch(/not paid/);
    expect(ops.readyToFileBlockers(input({ order: { status: "partially_refunded", payment_mode: "sandbox" } }))).toEqual([]);
  });

  it("in production, refuses every non-live payment and allows live", () => {
    for (const mode of ["sandbox", "test"]) {
      expect(ops.readyToFileBlockers(input({ production: true, order: { status: "paid", payment_mode: mode } })).join(" ")).toMatch(/test mode\. No money was collected/);
    }
    expect(ops.readyToFileBlockers(input({ production: true, order: { status: "paid", payment_mode: "live" } }))).toEqual([]);
  });

  it("refuses an unverified rule or a missing intake form", () => {
    expect(ops.readyToFileBlockers(input({ ruleVerificationStatus: "unverified" })).join(" ")).toMatch(/not verified/);
    expect(ops.readyToFileBlockers(input({ schema: undefined })).join(" ")).toMatch(/no intake form/);
  });
});

describe("markReadyToFile / markInProgress", () => {
  it("transitions when every check passes", async () => {
    await ops.markReadyToFile(staff, FILING);
    expect(transitions()).toEqual(["ready_to_file"]);
  });

  it("refuses, without changing status, when the customer edited after signing", async () => {
    fake.answers = { ...validAnswers(), entity_number: "7654321" };
    await expect(ops.markReadyToFile(staff, FILING)).rejects.toThrow(/Don't file yet\..*changed after they signed/);
    expect(transitions()).toEqual([]);
  });

  it("refuses a sandbox order on the production deployment", async () => {
    process.env.VERCEL_ENV = "production";
    await expect(ops.markReadyToFile(staff, FILING)).rejects.toBeInstanceOf(ops.OperationError);
    expect(transitions()).toEqual([]);
    fake.order = { status: "paid", payment_mode: "live", government_fee_cents: 700 };
    await ops.markReadyToFile(staff, FILING);
    expect(transitions()).toEqual(["ready_to_file"]);
  });

  it("re-checks before Start filing", async () => {
    fake.status = "ready_to_file";
    fake.verification = "unverified";
    await expect(ops.markInProgress(staff, FILING)).rejects.toThrow(/not verified/);
    expect(transitions()).toEqual([]);
    fake.verification = "verified";
    await ops.markInProgress(staff, FILING);
    expect(transitions()).toEqual(["in_progress"]);
  });
});

describe("markSubmitted / reopenFiling apply the same check (security finding payments-05)", () => {
  it("refuses to mark a refunded filing submitted, without changing status", async () => {
    fake.status = "in_progress";
    fake.order = { status: "refunded", payment_mode: "sandbox", government_fee_cents: 700 };
    await expect(ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-200", submittedAt: null })).rejects.toThrow(/not paid/);
    expect(transitions()).toEqual([]);
    expect(fake.inserts.filter((i) => i.table === "filing_receipts")).toEqual([]);
    expect(fake.sends).toEqual([]);
  });

  it("refuses to mark submitted from ready_to_file when the answers changed after signing", async () => {
    fake.status = "ready_to_file";
    fake.answers = { ...validAnswers(), entity_number: "7654321" };
    await expect(ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-201", submittedAt: null })).rejects.toThrow(/changed after they signed/);
    expect(transitions()).toEqual([]);
  });

  it("refuses a sandbox order on the production deployment", async () => {
    process.env.VERCEL_ENV = "production";
    fake.status = "in_progress";
    await expect(ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-202", submittedAt: null })).rejects.toThrow(/test mode/);
    expect(transitions()).toEqual([]);
  });

  it("still marks a signed, paid sandbox order submitted outside production (the staging journey)", async () => {
    fake.status = "ready_to_file";
    const result = await ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-203", submittedAt: null });
    expect(transitions()).toEqual(["submitted"]);
    expect(result.email?.status).toBe("outbox");
  });

  it("Retry filing re-checks before sending a rejected filing back to ready_to_file", async () => {
    fake.status = "rejected";
    fake.verification = "unverified";
    await expect(ops.reopenFiling(staff, FILING, "")).rejects.toThrow(/not verified/);
    expect(transitions()).toEqual([]);
    fake.verification = "verified";
    await ops.reopenFiling(staff, FILING, "Fixed the typo");
    expect(transitions()).toEqual(["ready_to_file"]);
  });

  it("reopening a cancelled filing for review needs only a paid order", async () => {
    fake.status = "cancelled";
    fake.verification = "unverified";
    await ops.reopenFiling(staff, FILING, "");
    expect(transitions()).toEqual(["ready_for_review"]);
  });
});

describe("customer emails report what really happened", () => {
  it("maps send results to operator outcomes", () => {
    expect(ops.toNotifyOutcome({ status: "sent", notificationId: "n" }, "resend").status).toBe("delivered");
    expect(ops.toNotifyOutcome({ status: "sent", notificationId: "n" }, "outbox").status).toBe("outbox");
    expect(ops.toNotifyOutcome({ status: "failed", notificationId: "n" }, "resend").status).toBe("failed");
    expect(ops.toNotifyOutcome({ status: "suppressed", notificationId: "n" }, "resend").status).toBe("suppressed");
    expect(ops.toNotifyOutcome({ status: "duplicate", notificationId: null }, "resend").status).toBe("duplicate");
  });

  it("markSubmitted records the order's state fee, and a failed receipt row or email is a warning, not an error", async () => {
    fake.status = "in_progress";
    fake.order = { status: "paid", payment_mode: "sandbox", government_fee_cents: 0 }; // PA nonprofit: $0 state fee
    fake.receiptInsertError = { message: "insert failed" };
    fake.sendThrows = true;
    const result = await ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-123", submittedAt: null });
    expect(transitions()).toEqual(["submitted"]);
    expect(fake.inserts.find((i) => i.table === "filing_receipts")?.row.state_fee_paid_cents).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/receipt record could not be saved/);
    expect(result.email?.status).toBe("failed");
  });

  it("says outbox, not delivered, when email is in outbox mode", async () => {
    fake.status = "in_progress";
    const result = await ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-124", submittedAt: null });
    expect(result.email?.status).toBe("outbox");
    fake.provider = "resend";
    fake.status = "in_progress";
    const delivered = await ops.markSubmitted(staff, FILING, { confirmationNumber: "PA-125", submittedAt: null });
    expect(delivered.email?.status).toBe("delivered");
  });
});

describe("accepted email and document_ready", () => {
  it("does not send the 'accepted' email until a customer-visible receipt is on file", async () => {
    fake.status = "submitted";
    fake.receiptDocs = 0;
    const result = await ops.markAccepted(staff, FILING);
    expect(result).toMatchObject({ completed: false, email: null });
    expect(transitions()).toEqual(["accepted"]);
    expect(fake.sends.map((s) => s.templateKey)).toEqual([]);
  });

  it("completes and sends one 'accepted' email when the receipt is already uploaded", async () => {
    fake.status = "submitted";
    fake.receiptDocs = 1;
    const result = await ops.markAccepted(staff, FILING);
    expect(result.completed).toBe(true);
    expect(transitions()).toEqual(["accepted", "completed"]);
    expect(fake.sends.map((s) => s.templateKey)).toEqual(["filing_accepted"]);
    expect(fake.sends[0].dedupeKey).toBe(`filing_accepted:${FILING}:accepted`);
  });

  it("emails document_ready after a customer-visible upload", async () => {
    fake.status = "submitted";
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "receipt.pdf", { type: "application/pdf" });
    const result = await ops.uploadFilingDocument(staff, FILING, { file, kind: "filed_report", visibleToCustomer: true });
    expect(result.completed).toBe(false);
    expect(result.documentEmail?.status).toBe("outbox");
    expect(fake.sends).toHaveLength(1);
    expect(fake.sends[0]).toMatchObject({
      userId: "user-1",
      templateKey: "document_ready",
      dedupeKey: "document_ready:doc-1",
      ctaPath: `/dashboard/filings/${FILING}`,
      businessId: "business-1",
      filingId: FILING,
      vars: expect.objectContaining({ businessName: "Keystone Test Bakery LLC", filingName: "Annual Report", documentLabel: "Filed report" }),
    });
  });

  it("does not email the customer about an internal document", async () => {
    fake.status = "submitted";
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "notes.pdf", { type: "application/pdf" });
    const result = await ops.uploadFilingDocument(staff, FILING, { file, kind: "other", visibleToCustomer: false });
    expect(result.documentEmail).toBeNull();
    expect(fake.sends).toHaveLength(0);
  });

  it("a receipt uploaded after acceptance completes the filing and sends the 'accepted' email", async () => {
    fake.status = "accepted";
    fake.receiptDocs = 1;
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "ack.pdf", { type: "application/pdf" });
    const result = await ops.uploadFilingDocument(staff, FILING, { file, kind: "acknowledgement", visibleToCustomer: true });
    expect(result.completed).toBe(true);
    expect(transitions()).toEqual(["completed"]);
    expect(fake.sends.map((s) => s.templateKey)).toEqual(["filing_accepted", "document_ready"]);
    expect(result.acceptedEmail?.status).toBe("outbox");
  });
});
