import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The legal fields that come from NEXT_PUBLIC_* settings (governing law, postal address,
 * legal entity), locked in on what they change: the terms page's sections, the
 * subscriber reminder gate (CAN-SPAM) and the bracketed placeholders. `site` is read once
 * per module load, so every case stubs the env, resets modules and imports afresh. The
 * values below are obviously fake and exist only in this file.
 */

const TEST_ADDRESS = "TEST ONLY 1 Example Street, Nowhere, ZZ 00000";
const TEST_LAW = "the State of Testland";
const TEST_ENTITY = "TEST ONLY Example Operator";

const h = vi.hoisted(() => ({
  subscribers: [] as Record<string, unknown>[],
  due: [] as Record<string, unknown>[],
  updates: [] as { table: string; payload: Record<string, unknown>; filters: [string, unknown][] }[],
  sent: [] as { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }[],
}));

/** Minimal in-memory stand-in for the service-role client, covering the calls the reminder cycle makes. */
function query(table: string) {
  const state = { op: "select" as "select" | "update" | "insert" | "upsert", payload: null as unknown, filters: [] as [string, unknown][] };
  const resolve = () => {
    if (state.op === "update") {
      h.updates.push({ table, payload: state.payload as Record<string, unknown>, filters: state.filters });
      return { data: null, error: null };
    }
    if (state.op === "upsert") return { data: null, error: null, count: 0 };
    if (state.op === "insert") return { data: null, error: null };
    if (table === "reminder_subscribers") {
      const id = state.filters.find(([c]) => c === "id")?.[1];
      return { data: id ? (h.subscribers.find((s) => s.id === id) ?? null) : h.subscribers, error: null };
    }
    if (table === "subscriber_reminders") return { data: h.due, error: null };
    return { data: null, error: null }; // no suppressions
  };
  const b = {
    select: () => b,
    update: (payload: unknown) => ((state.op = "update"), (state.payload = payload), b),
    insert: (payload: unknown) => ((state.op = "insert"), (state.payload = payload), b),
    upsert: (payload: unknown) => ((state.op = "upsert"), (state.payload = payload), b),
    eq: (col: string, val: unknown) => (state.filters.push([col, val]), b),
    neq: () => b,
    in: () => b,
    is: () => b,
    lte: () => b,
    ilike: () => b,
    order: () => b,
    limit: () => b,
    maybeSingle: async () => resolve(),
    single: async () => resolve(),
    then: (ok: (v: unknown) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(resolve()).then(ok, fail),
  };
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: query }) }));
vi.mock("@/lib/email/provider", () => ({
  getEmailProvider: () => ({
    name: "outbox",
    send: async (m: (typeof h.sent)[number]) => {
      h.sent.push(m);
      return { id: `msg-${h.sent.length}` };
    },
  }),
}));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn(async () => {}) }));
vi.mock("@/lib/analytics/attribution-server", () => ({ readAttribution: vi.fn(async () => null) }));
vi.mock("@/lib/compliance/public-quote", () => ({ publicQuote: vi.fn(async () => ({ serviceFeeCents: 4900 })) }));

function stubLegalEnv(values: { governingLaw?: string; postalAddress?: string; legalEntity?: string }) {
  // Empty means "unset" (site.ts trims and falls back), whatever the developer's shell has.
  vi.stubEnv("NEXT_PUBLIC_GOVERNING_LAW", values.governingLaw ?? "");
  vi.stubEnv("NEXT_PUBLIC_POSTAL_ADDRESS", values.postalAddress ?? "");
  vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", values.legalEntity ?? "");
  vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "");
  vi.stubEnv("NEXT_PUBLIC_BRAND_NAME", "");
  vi.resetModules();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The h2 headings of the rendered terms, as visible text. */
async function termsHeadings(): Promise<{ headings: string[]; html: string }> {
  const { default: TermsPage } = await import("@/app/(marketing)/legal/terms/page");
  const html = renderToStaticMarkup(createElement(TermsPage));
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  return { headings, html };
}

describe("terms of service: governing law (NEXT_PUBLIC_GOVERNING_LAW)", () => {
  it("unset: no Governing law section, and Contact is section 17", async () => {
    stubLegalEnv({});
    const { headings, html } = await termsHeadings();
    expect(headings.some((t) => /governing law/i.test(t))).toBe(false);
    expect(html).not.toMatch(/governed by the laws of/i);
    expect(headings.at(-1)).toBe("17. Contact");
    expect(headings).toHaveLength(17);
  });

  it("set: section 17 is Governing law with that value, and Contact is section 18", async () => {
    stubLegalEnv({ governingLaw: TEST_LAW });
    const { headings, html } = await termsHeadings();
    expect(headings.slice(-2)).toEqual(["17. Governing law", "18. Contact"]);
    expect(html).toContain(`These terms are governed by the laws of ${TEST_LAW}, without regard to its conflict-of-law rules.`);
  });

  it("sections 1 to 16 keep their numbers either way", async () => {
    stubLegalEnv({});
    const unset = (await termsHeadings()).headings.slice(0, 16);
    stubLegalEnv({ governingLaw: TEST_LAW });
    const set = (await termsHeadings()).headings.slice(0, 16);
    expect(set).toEqual(unset);
    expect(unset.map((t) => Number(t.split(".")[0]))).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });
});

describe("postal address (NEXT_PUBLIC_POSTAL_ADDRESS)", () => {
  it("unset: postalAddressText() is the support-email wording, also on the terms page", async () => {
    stubLegalEnv({});
    const legal = await import("@/lib/seo/legal");
    expect(legal.postalAddressText()).toBe("available on request from support@getfilewell.com");
    const { html } = await termsHeadings();
    expect(html).toContain("Postal address for legal notices: available on request from support@getfilewell.com.");
  });

  it("set: postalAddressText() is the configured address", async () => {
    stubLegalEnv({ postalAddress: TEST_ADDRESS });
    expect((await import("@/lib/seo/legal")).postalAddressText()).toBe(TEST_ADDRESS);
  });
});

describe("subscriber reminders are gated on the postal address (CAN-SPAM)", () => {
  const NOW = new Date("2026-11-01T15:00:00Z"); // November 1, 2026, Eastern

  beforeEach(() => {
    h.subscribers = [
      {
        id: "sub-1",
        email: "subscriber@unit-test-only.com",
        state_code: "PA",
        entity_type: "lp",
        is_foreign: false,
        is_nonprofit: false,
        legal_name: "Example Partners LP",
        entity_number: null,
        formation_date: null,
        status: "confirmed",
        consent_at: "2026-10-01T12:00:00Z",
        confirmation_sent_at: "2026-10-01T12:00:00Z",
        attribution: null,
      },
    ];
    h.due = [{ id: "rem-1", subscriber_id: "sub-1", due_date: "2026-12-31", offset_days: -60, scheduled_for: "2026-11-01" }];
    h.updates = [];
    h.sent = [];
  });

  const reminderUpdates = () => h.updates.filter((u) => u.table === "subscriber_reminders");

  it("unset: the reminder is skipped with reason no_postal_address and no email is sent", async () => {
    stubLegalEnv({});
    const { runSubscriberReminderCycle } = await import("@/lib/reminders/subscribers");
    const summary = await runSubscriberReminderCycle(NOW);
    expect(summary).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
    expect(h.sent).toHaveLength(0);
    expect(reminderUpdates()).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ status: "skipped", skip_reason: "no_postal_address" }), filters: expect.arrayContaining([["id", "rem-1"]]) }),
    ]);
  });

  it("set: the reminder is not skipped for that reason; it is sent with the address in the footer", async () => {
    stubLegalEnv({ postalAddress: TEST_ADDRESS });
    const { runSubscriberReminderCycle } = await import("@/lib/reminders/subscribers");
    const summary = await runSubscriberReminderCycle(NOW);
    expect(summary).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
    expect(reminderUpdates().some((u) => u.payload.skip_reason === "no_postal_address")).toBe(false);
    expect(reminderUpdates()).toEqual([expect.objectContaining({ payload: expect.objectContaining({ status: "sent" }) })]);

    // CAN-SPAM is why the send is gated: the rendered email must carry the address.
    expect(h.sent).toHaveLength(1);
    const [email] = h.sent;
    expect(email.to).toBe("subscriber@unit-test-only.com");
    const footer = email.text.split("\n\n----\n\n")[1] ?? "";
    expect(footer).toContain(TEST_ADDRESS);
    expect(footer).toContain("Stop deadline reminders:");
    expect(email.html).toContain(TEST_ADDRESS);
    expect(email.headers?.["List-Unsubscribe"]).toMatch(/\/api\/reminders\/unsubscribe\?t=/);
  });
});

describe("legal entity (NEXT_PUBLIC_LEGAL_ENTITY)", () => {
  it("unset: legalEntityText() is the bracketed placeholder", async () => {
    stubLegalEnv({});
    expect((await import("@/lib/seo/legal")).legalEntityText()).toBe("[legal name of the operating company, to be confirmed]");
  });

  it("set: legalEntityText() is the configured name, and the terms name it as the operator", async () => {
    stubLegalEnv({ legalEntity: TEST_ENTITY });
    expect((await import("@/lib/seo/legal")).legalEntityText()).toBe(TEST_ENTITY);
    const { html } = await termsHeadings();
    expect(html).toContain(`These terms are an agreement between you and ${TEST_ENTITY}`);
  });
});

describe("terms of service: states we file in", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&ldquo;|&rdquo;|“|”/g, '"').replace(/\s+/g, " ");

  it("names every state whose sales switch is on, not Pennsylvania alone", async () => {
    stubLegalEnv({});
    vi.stubEnv("FL_LIVE_FILING_SALES", "true");
    vi.stubEnv("CO_LIVE_FILING_SALES", "true");
    const { html } = await termsHeadings();
    expect(text(html)).toContain('Today we file annual reports in Colorado, Florida and Pennsylvania, shown as "Filing supported" on our site.');
    expect(text(html)).not.toContain("only in Pennsylvania");
  });

  it("never names a state whose switch is off", async () => {
    stubLegalEnv({});
    vi.stubEnv("FL_LIVE_FILING_SALES", "");
    vi.stubEnv("PA_LIVE_FILING_SALES", "false");
    const { html } = await termsHeadings();
    expect(text(html)).toContain('We file only in states shown as "Filing supported" on our site.');
    expect(text(html)).not.toMatch(/Today we file annual reports in/);
  });
});
