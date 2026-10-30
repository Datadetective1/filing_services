import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/**
 * The customer path to registered agent service: the progress tracker only shows steps that
 * were recorded, prefill builds a usable address line, and the public pages hand visitors to
 * the order without asking anything twice.
 */

vi.mock("server-only", () => ({}));
const { serviceProgress } = await import("@/lib/services/progress");
const { addressLine, situationFor } = await import("@/lib/services/orders");

describe("what happens next", () => {
  const base = { billingStatus: "active" as const, serviceStatus: "pending_appointment" as const, origin: "switching" as const };

  it("after payment, the agent setup is the current step and nothing later is claimed", () => {
    const p = serviceProgress({ ...base, orders: [{ kind: "registered_agent", status: "payment_confirmed" }, { kind: "change_of_agent", status: "payment_confirmed" }] })!;
    expect(p.steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(p.needsCustomer).toBe(false);
  });

  it("moves on only when the provider order and the state filing are recorded", () => {
    const placed = serviceProgress({ ...base, orders: [{ kind: "registered_agent", status: "submitted_to_provider" }, { kind: "change_of_agent", status: "processing" }] })!;
    expect(placed.steps.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
    const filed = serviceProgress({ ...base, orders: [{ kind: "registered_agent", status: "processing" }, { kind: "change_of_agent", status: "completed" }] })!;
    expect(filed.steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
  });

  it("says when we're waiting on the customer", () => {
    const p = serviceProgress({ ...base, orders: [{ kind: "registered_agent", status: "information_needed" }] })!;
    expect(p.needsCustomer).toBe(true);
    expect(p.steps[1].detail).toMatch(/We need something from you/);
  });

  it("waits on payment confirmation first, and has no tracker once service is ending", () => {
    const p = serviceProgress({ ...base, billingStatus: "pending", orders: [] })!;
    expect(p.steps[0].state).toBe("current");
    expect(serviceProgress({ ...base, serviceStatus: "cancellation_requested", orders: [] })).toBeNull();
  });

  it("a new business names us in its own formation filing", () => {
    const p = serviceProgress({ ...base, origin: "new_entity", orders: [{ kind: "registered_agent", status: "active" }] })!;
    expect(p.steps[2].label).toMatch(/name us/);
  });

  it("promises no dates or speeds", () => {
    const src = readFileSync("src/lib/services/progress.ts", "utf8");
    expect(src).not.toMatch(/same day|within \\d|hours|business days/i);
  });
});

describe("order prefill", () => {
  it("builds one address line from what is stored", () => {
    expect(addressLine({ line1: "100 Congress Ave", line2: "Suite 2", city: "Austin", region: "TX", postal_code: "78701" })).toBe("100 Congress Ave, Suite 2, Austin, TX 78701");
    expect(addressLine({ line1: "1 Main St", city: "Erie", region: "PA" })).toBe("1 Main St, Erie, PA");
    expect(addressLine({ city: "Erie" })).toBe("");
    expect(addressLine(null)).toBe("");
  });

  it("derives a switch from the business instead of asking", () => {
    expect(situationFor({ lifecycle: "existing" })).toBe("switching");
    expect(situationFor({ lifecycle: "forming" })).toBe("new_entity");
  });
});

describe("public pages hand off to the order", () => {
  it("send visitors through the intent route, without prefetching it", () => {
    for (const f of ["src/app/(marketing)/registered-agent/page.tsx", "src/app/(marketing)/registered-agent/[state]/page.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toMatch(/href=\{?[`"]\/registered-agent\/start/);
      expect(src).toMatch(/prefetch=\{false\}/);
    }
  });

  it("the order page asks no situation question and prefills the form", () => {
    const page = readFileSync("src/app/(app)/dashboard/services/new/page.tsx", "utf8");
    expect(page).not.toMatch(/already have a registered agent\?/);
    expect(page).toMatch(/loadOrderPrefill/);
    const form = readFileSync("src/components/services/service-order-form.tsx", "utf8");
    expect(form).toMatch(/defaultValue=\{prefill\.contactName\}/);
    expect(form).not.toMatch(/name="currentAgentName"[^>]*required/);
    // Renewal terms stay in view next to the consent box, never collapsed.
    expect(form).not.toMatch(/<details/);
  });
});
