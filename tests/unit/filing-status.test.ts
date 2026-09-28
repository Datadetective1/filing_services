import { describe, expect, it } from "vitest";
import {
  ACTIVE_OPERATIONS_STATUSES,
  canTransition,
  CUSTOMER_EDITABLE_STATUSES,
  CUSTOMER_STATUS_DESCRIPTIONS,
  FILED_STATUSES,
  FILING_STATUS_LABELS,
  FILING_STATUS_TONES,
  FILING_STATUSES,
  FILING_TRANSITIONS,
  isFilingStatus,
  OPERATOR_NEXT_ACTION,
  TERMINAL_STATUSES,
} from "@/lib/domain/filing-status";

describe("filing status machine", () => {
  it("has no transitions out of refunded", () => {
    expect(FILING_TRANSITIONS.refunded).toEqual([]);
    for (const to of FILING_STATUSES) expect(canTransition("refunded", to)).toBe(false);
  });

  it("never allows a self-transition and only targets known statuses", () => {
    for (const from of FILING_STATUSES) {
      expect(canTransition(from, from)).toBe(false);
      for (const to of FILING_TRANSITIONS[from]) expect(isFilingStatus(to)).toBe(true);
    }
  });

  it("follows the documented lifecycle", () => {
    expect(canTransition("draft", "ready_for_review")).toBe(true);
    expect(canTransition("draft", "needs_information")).toBe(true);
    expect(canTransition("draft", "submitted")).toBe(false);
    expect(canTransition("submitted", "accepted")).toBe(true);
    expect(canTransition("submitted", "rejected")).toBe(true);
    expect(canTransition("submitted", "cancelled")).toBe(false);
    expect(canTransition("accepted", "completed")).toBe(true);
    expect(canTransition("cancelled", "refunded")).toBe(true);
    expect(canTransition("completed", "refunded")).toBe(false);
  });

  it("every non-refunded status can move somewhere", () => {
    for (const s of FILING_STATUSES) {
      if (s === "refunded") continue;
      expect(FILING_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("recognizes statuses", () => {
    expect(isFilingStatus("draft")).toBe(true);
    expect(isFilingStatus("paid")).toBe(false);
    expect(isFilingStatus(null)).toBe(false);
    expect(isFilingStatus(3)).toBe(false);
  });
});

describe("status copy", () => {
  it("has a label, description, tone and operator action for every status", () => {
    for (const s of FILING_STATUSES) {
      expect(FILING_STATUS_LABELS[s]).toBeTruthy();
      expect(CUSTOMER_STATUS_DESCRIPTIONS[s]).toBeTruthy();
      expect(FILING_STATUS_TONES[s]).toBeTruthy();
      expect(OPERATOR_NEXT_ACTION[s]).toBeTruthy();
    }
    expect(Object.keys(FILING_STATUS_LABELS).sort()).toEqual([...FILING_STATUSES].sort());
  });

  it("uses no em or en dashes in visible copy", () => {
    const copy = [
      ...Object.values(FILING_STATUS_LABELS),
      ...Object.values(CUSTOMER_STATUS_DESCRIPTIONS),
      ...Object.values(OPERATOR_NEXT_ACTION),
    ];
    for (const c of copy) expect(c).not.toMatch(/[–—]/);
  });

  it("labels are unique", () => {
    const labels = Object.values(FILING_STATUS_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("status groups", () => {
  it("customers may edit answers only before we take the filing", () => {
    expect([...CUSTOMER_EDITABLE_STATUSES].sort()).toEqual(["draft", "needs_customer_action", "needs_information"]);
    for (const s of FILED_STATUSES) expect(CUSTOMER_EDITABLE_STATUSES).not.toContain(s);
  });

  it("filed, terminal and active groups are consistent", () => {
    expect([...FILED_STATUSES].sort()).toEqual(["accepted", "completed", "submitted"]);
    expect([...TERMINAL_STATUSES].sort()).toEqual(["cancelled", "completed", "refunded"]);
    for (const s of TERMINAL_STATUSES) expect(ACTIVE_OPERATIONS_STATUSES).not.toContain(s);
    expect(ACTIVE_OPERATIONS_STATUSES).not.toContain("draft");
  });
});
