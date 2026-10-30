import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { REGISTERED_AGENT_FAQ } = await import("@/lib/services/public-faq");
const { DEFAULT_TEMPLATES } = await import("@/lib/email/templates");

// Filewell never promises more than its registered agent provider promises it.
const OVERPROMISE = /same.?day|within 24|24 hours|24\/7|guaranteed (delivery|within)|never miss|immediately|we('|’)ll call|we also try to (call|reach)/i;

describe("business services copy", () => {
  it("the registered agent FAQ promises no delivery time", () => {
    for (const f of REGISTERED_AGENT_FAQ) expect(f.a, f.q).not.toMatch(OVERPROMISE);
  });

  it("business services emails promise no delivery time", () => {
    const keys = /^(service_|ra_|staff_ra_|staff_new_service)/;
    for (const t of DEFAULT_TEMPLATES.filter((t) => keys.test(t.key))) {
      expect(`${t.subject} ${t.body}`, t.key).not.toMatch(OVERPROMISE);
    }
  });

  it("the terms cap liability, require current contact details and name no person", () => {
    const page = readFileSync("src/app/(marketing)/legal/business-services/page.tsx", "utf8");
    expect(page).toMatch(/12 months before the event/);
    expect(page).toMatch(/keep your email address, phone number, contact person and address current/);
    expect(page).toMatch(/defend, indemnify and hold harmless/);
    expect(page).toMatch(/do not\s+guarantee any delivery time/);
    expect(page).toMatch(/weekend or holiday/);
    expect(page).not.toMatch(/Amary|Coulibaly/);
  });
});
