import { describe, expect, it, vi } from "vitest";

/**
 * The operator console says exactly what to do for each state: the right portal in the
 * next step, a consent upload that belongs to the current signature, and the state's own
 * receipt. Status evidence is matched on the entity number the customer signed.
 */

vi.mock("server-only", () => ({}));
const { operatorNextStep, statePortalHost } = await import("@/components/admin/operator-guidance");
const { consentUploadedSince } = await import("@/lib/filings/operations");
const { filingEntityNumber } = await import("@/lib/filings/customer");

describe("next step names the filing's own state portal", () => {
  it("Pennsylvania keeps file.dos.pa.gov; WA, NV and UT name theirs", () => {
    const step = (stateCode?: string) => operatorNextStep({ status: "in_progress", orderStatus: "paid", stateCode })?.instruction;
    expect(step()).toBe("Finish filing on file.dos.pa.gov, enter the confirmation number, then click Mark submitted");
    expect(step("PA")).toContain("file.dos.pa.gov");
    expect(statePortalHost("WA")).toBe("ccfs.sos.wa.gov");
    expect(step("WA")).toContain("ccfs.sos.wa.gov");
    for (const st of ["WA", "NV", "UT"]) expect(step(st), st).not.toContain("file.dos.pa.gov");
    expect(statePortalHost("ZZ")).toBe("the state's portal");
  });
});

describe("registered agent consent belongs to the current signature", () => {
  it("an upload made before the latest signature (an earlier agent change) doesn't count", () => {
    const signedAt = "2026-10-20T10:00:00Z";
    expect(consentUploadedSince([{ created_at: "2026-10-19T10:00:00Z" }], signedAt)).toBe(false);
    expect(consentUploadedSince([{ created_at: "2026-10-19T10:00:00Z" }, { created_at: "2026-10-21T09:00:00Z" }], signedAt)).toBe(true);
    expect(consentUploadedSince([{ created_at: "2026-10-21T09:00:00Z" }], null)).toBe(false);
    expect(consentUploadedSince([], signedAt)).toBe(false);
  });
});

describe("status evidence is matched on the entity number being filed", () => {
  it("uses the signed answer first (a manual lookup leaves the business row empty), else the business record", () => {
    expect(filingEntityNumber({ state_entity_number: null }, { entity_number: "604 123 456" })).toBe("604 123 456");
    expect(filingEntityNumber({ state_entity_number: "604999999" }, { entity_number: "604 123 456" })).toBe("604 123 456");
    expect(filingEntityNumber({ state_entity_number: "604999999" }, { entity_number: "" })).toBe("604999999");
    expect(filingEntityNumber(null, {})).toBeNull();
  });
});
