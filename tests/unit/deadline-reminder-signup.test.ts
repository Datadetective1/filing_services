import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const subscribe = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/reminders/subscribers", () => ({ subscribeToReminders: (...a: unknown[]) => subscribe(...a) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: vi.fn(async () => true) }));
vi.mock("@/lib/security/request", () => ({ clientIpHash: async () => "ip" }));

import { signUpForDeadlineReminder } from "@/app/(marketing)/reminders/signup-actions";
import { countReminderPages } from "@/lib/acquisition/dashboard";
import { cleanSignupPage, formationFromMonth, reminderSignupOptions } from "@/lib/reminders/signup-options";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const base = { stateCode: "PA", entityType: "llc", businessName: "Maple Bakery LLC", email: "Owner@Example.com", consent: "yes", page: "/annual-report/pennsylvania" };

describe("reminder box options by state", () => {
  it("offers every verified Pennsylvania entity type, LLC first, with no formation month (fixed dates)", () => {
    const o = reminderSignupOptions("PA")!;
    expect(o.stateName).toBe("Pennsylvania");
    expect(o.entities[0].value).toBe("llc");
    expect(o.entities.length).toBeGreaterThan(3);
    expect(o.entities.every((e) => !e.needsFormation)).toBe(true);
    expect(o.consentText).toMatch(/unsubscribe/i);
  });

  it("asks for the formation month where the due date follows it", () => {
    for (const st of ["CO", "NV", "UT", "WA", "SD"]) {
      const o = reminderSignupOptions(st)!;
      expect(o, st).not.toBeNull();
      expect(o.entities.every((e) => e.needsFormation), st).toBe(true);
    }
    expect(reminderSignupOptions("FL")!.entities.every((e) => !e.needsFormation)).toBe(true);
  });

  it("shows nothing where we haven't verified the rule (we can't compute the due date)", () => {
    expect(reminderSignupOptions("TX")).toBeNull();
    expect(reminderSignupOptions("NY")).toBeNull();
    expect(reminderSignupOptions("ZZ")).toBeNull();
  });

  it("narrows to one entity type on an entity page", () => {
    expect(reminderSignupOptions("PA", "corporation")!.entities.map((e) => e.value)).toEqual(["corporation"]);
  });

  it("keeps only plain site paths for counting, and only real past months for formation", () => {
    expect(cleanSignupPage("/annual-report/pennsylvania/llc?x=1")).toBe("/annual-report/pennsylvania/llc");
    expect(cleanSignupPage("https://evil.example/")).toBeNull();
    expect(cleanSignupPage("/a b")).toBeNull();
    expect(formationFromMonth("3", "2021", "2026-11-15")).toBe("2021-03-01");
    expect(formationFromMonth("12", "2026", "2026-11-15")).toBeNull();
    expect(formationFromMonth("13", "2021", "2026-11-15")).toBeNull();
    expect(formationFromMonth("", "", "2026-11-15")).toBeNull();
  });
});

describe("signing up from a state page", () => {
  beforeEach(() => {
    subscribe.mockReset();
    subscribe.mockResolvedValue({ status: "sent" });
  });

  it("subscribes the typed business with the page it came from", async () => {
    const r = await signUpForDeadlineReminder(undefined, form(base));
    expect(r).toEqual({ ok: true, email: "owner@example.com" });
    const [email, lookup, consent, opts] = subscribe.mock.calls[0];
    expect(email).toBe("owner@example.com");
    expect(consent).toBe(true);
    expect(lookup).toMatchObject({ stateCode: "PA", entityType: "llc", legalName: "Maple Bakery LLC", formationDate: null, entityNumber: null, isForeign: false });
    expect(opts).toEqual({ page: "/annual-report/pennsylvania" });
  });

  it("needs ticked consent, a name and a valid email, and hands back what was typed", async () => {
    const r = await signUpForDeadlineReminder(undefined, form({ ...base, consent: "", email: "nope", businessName: " " }));
    expect(r?.ok).toBe(false);
    if (r?.ok === false) {
      expect(r.fieldErrors).toMatchObject({ consent: expect.any(String), email: expect.any(String), businessName: expect.any(String) });
      expect(r.values?.email).toBe("nope");
    }
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("asks for the formation month in anniversary states and passes it on", async () => {
    const missing = await signUpForDeadlineReminder(undefined, form({ ...base, stateCode: "CO", page: "/annual-report/colorado" }));
    expect(missing?.ok === false && missing.fieldErrors?.formed).toBeTruthy();
    expect(subscribe).not.toHaveBeenCalled();
    const ok = await signUpForDeadlineReminder(undefined, form({ ...base, stateCode: "CO", month: "4", year: "2019", page: "/annual-report/colorado" }));
    expect(ok?.ok).toBe(true);
    expect(subscribe.mock.calls[0][1]).toMatchObject({ stateCode: "CO", formationDate: "2019-04-01" });
  });

  it("refuses an entity type the state doesn't have and states without a verified rule", async () => {
    const wrongType = await signUpForDeadlineReminder(undefined, form({ ...base, stateCode: "FL", entityType: "business_trust" }));
    expect(wrongType?.ok === false && wrongType.fieldErrors?.entityType).toBeTruthy();
    const noRule = await signUpForDeadlineReminder(undefined, form({ ...base, stateCode: "TX" }));
    expect(noRule?.ok).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("a filled honeypot looks like success and saves nothing", async () => {
    const r = await signUpForDeadlineReminder(undefined, form({ ...base, fw_hp: "bot" }));
    expect(r?.ok).toBe(true);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("drops a page that isn't a plain site path", async () => {
    await signUpForDeadlineReminder(undefined, form({ ...base, page: "https://elsewhere.example/x" }));
    expect(subscribe.mock.calls[0][3]).toEqual({ page: null });
  });

  it("the form never points to the state's own filing site", () => {
    for (const f of ["src/components/funnel/deadline-reminder-form.tsx", "src/app/(marketing)/reminders/signup-actions.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/https?:\/\/(?!.*getfilewell)[a-z0-9.-]+\.(gov|us)\b/i);
    }
  });
});

describe("counting sign-ups by page", () => {
  it("groups opt-ins and confirmations by page, most sign-ups first", () => {
    const rows = [
      { event_name: "reminder_opt_in" as const, properties: { page: "/annual-report/pennsylvania" } },
      { event_name: "reminder_opt_in" as const, properties: { page: "/annual-report/pennsylvania" } },
      { event_name: "reminder_confirmed" as const, properties: { page: "/annual-report/pennsylvania" } },
      { event_name: "reminder_opt_in" as const, properties: { page: "/find/result" } },
      { event_name: "reminder_opt_in" as const, properties: {} },
      { event_name: "visit_started" as const, properties: { page: "/x" } },
    ];
    expect(countReminderPages(rows)).toEqual([
      { page: "/annual-report/pennsylvania", optIns: 2, confirmed: 1 },
      { page: "/find/result", optIns: 1, confirmed: 0 },
      { page: "unknown", optIns: 1, confirmed: 0 },
    ]);
  });
});
