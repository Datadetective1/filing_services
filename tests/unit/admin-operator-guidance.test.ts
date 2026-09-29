import { describe, expect, it } from "vitest";
import {
  customerWroteLast,
  emailOutcomeText,
  isTestPayment,
  operatorMessage,
  operatorNextStep,
  servicePriceApproval,
  supabaseEnvironment,
  TEST_ORDER_LABEL,
} from "@/components/admin/operator-guidance";
import { FILING_STATUSES } from "@/lib/domain/filing-status";
import type { ServicePrice } from "@/lib/domain/pricing";

describe("operatorNextStep", () => {
  const step = (status: string, orderStatus: string | null = "paid", customerReplied = false) =>
    operatorNextStep({ status, orderStatus, customerReplied });

  it("gives one plain instruction per status that needs the operator", () => {
    expect(step("ready_for_review")).toEqual({ instruction: "Review the details, then click Mark ready to file", kind: "action", reason: "status" });
    expect(step("ready_to_file")?.instruction).toBe("Click Start filing, then file on file.dos.pa.gov using the filing packet");
    expect(step("in_progress")?.instruction).toBe("Finish filing on file.dos.pa.gov, enter the confirmation number, then click Mark submitted");
    expect(step("submitted")?.instruction).toBe("Upload the state's approved report or receipt, then click Mark accepted");
    expect(step("accepted")?.instruction).toMatch(/^Upload the filed report or Acknowledgement Letter/);
    // Uploading the receipt completes the filing, so there is no button left to click.
    expect(step("accepted")?.instruction).not.toMatch(/click Complete filing/);
    expect(step("rejected")?.instruction).toMatch(/Retry filing, or contact the customer$/);
  });

  it("marks customer-waiting statuses as waiting, with no action", () => {
    for (const status of ["needs_information", "needs_customer_action"]) {
      expect(step(status)).toEqual({ instruction: "Waiting on the customer (no action unless they reply)", kind: "waiting", reason: "status" });
    }
  });

  it("tells the operator to read a customer's reply first", () => {
    for (const status of ["needs_customer_action", "ready_for_review", "in_progress", "submitted"]) {
      expect(step(status, "paid", true)).toEqual({ instruction: "Read and reply to the customer's message", kind: "action", reason: "customer_replied" });
    }
  });

  it("asks for a refund only while nothing has been refunded on a cancelled order", () => {
    expect(step("cancelled", "paid")).toMatchObject({ kind: "action", reason: "refund_owed" });
    expect(step("cancelled", "paid")?.instruction).toMatch(/^Issue the refund/);
    // Cancelled after submission: the service fee is refunded and the state keeps its fee. Nothing is owed.
    expect(step("cancelled", "partially_refunded")).toBeNull();
    expect(step("cancelled", "partially_refunded", true)).toBeNull();
    expect(step("cancelled", "refunded")).toBeNull();
    expect(step("cancelled", null)).toBeNull();
  });

  it("returns nothing for finished or unpaid filings", () => {
    expect(step("completed")).toBeNull();
    expect(step("refunded", "refunded")).toBeNull();
    expect(step("draft", "pending_payment")).toBeNull();
    expect(step("completed", "paid", true)).toBeNull();
  });

  it("never mentions a late fee, penalty or urgency, and never says 'completed' before completion", () => {
    for (const status of FILING_STATUSES) {
      for (const replied of [false, true]) {
        const text = step(status, "paid", replied)?.instruction ?? "";
        expect(text).not.toMatch(/late fee|penalt|urgent|immediately|dissolution/i);
        expect(text).not.toMatch(/completed/i);
      }
    }
  });
});

describe("customerWroteLast", () => {
  it("is true only when the newest customer message is newer than the newest staff message", () => {
    expect(customerWroteLast([])).toBe(false);
    expect(customerWroteLast([{ author_type: "customer", created_at: "2026-09-29T10:00:00Z" }])).toBe(true);
    expect(
      customerWroteLast([
        { author_type: "staff", created_at: "2026-09-29T09:00:00Z" },
        { author_type: "customer", created_at: "2026-09-29T10:00:00Z" },
      ]),
    ).toBe(true);
    expect(
      customerWroteLast([
        { author_type: "customer", created_at: "2026-09-29T10:00:00Z" },
        { author_type: "staff", created_at: "2026-09-29T11:00:00Z" },
      ]),
    ).toBe(false);
    expect(customerWroteLast([{ author_type: "system", created_at: "2026-09-29T10:00:00Z" }])).toBe(false);
  });

  it("treats a later staff status change as handling the customer's message", () => {
    const customerAt10 = [{ author_type: "customer", created_at: "2026-09-29T10:00:00Z" }];
    expect(customerWroteLast(customerAt10, "2026-09-29T11:00:00Z")).toBe(false);
    expect(customerWroteLast(customerAt10, "2026-09-29T09:00:00Z")).toBe(true);
    expect(customerWroteLast(customerAt10, null)).toBe(true);
    expect(customerWroteLast(customerAt10, "not a date")).toBe(true);
  });

  it("compares instants, not strings with different offsets", () => {
    expect(
      customerWroteLast([
        { author_type: "staff", created_at: "2026-09-29T10:30:00+00:00" },
        { author_type: "customer", created_at: "2026-09-29T07:00:00-04:00" },
      ]),
    ).toBe(true);
  });
});

describe("test payments", () => {
  it("flags every non-live payment mode, and nothing when there is no order", () => {
    expect(isTestPayment("sandbox")).toBe(true);
    expect(isTestPayment("test")).toBe(true);
    expect(isTestPayment("live")).toBe(false);
    expect(isTestPayment(null)).toBe(false);
    expect(isTestPayment(undefined)).toBe(false);
  });

  it("says plainly that no money was collected, without a long dash", () => {
    expect(TEST_ORDER_LABEL).toMatch(/^TEST/);
    expect(TEST_ORDER_LABEL).toMatch(/no money collected/);
    expect(TEST_ORDER_LABEL).not.toMatch(/[–—]/);
  });
});

describe("emailOutcomeText", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("says the customer was emailed only when the email was actually delivered", () => {
    expect(emailOutcomeText({ status: "delivered", notificationId: id }, "the confirmation number")).toBe("The customer was emailed the confirmation number.");
    const outbox = emailOutcomeText({ status: "outbox", notificationId: id }, "the confirmation number");
    expect(outbox).toMatch(/recorded but NOT delivered/);
    expect(outbox).toMatch(/outbox mode/);
    expect(outbox).not.toMatch(/was emailed/);
    const failed = emailOutcomeText({ status: "failed", notificationId: null }, "the reason");
    expect(failed).toMatch(/FAILED/);
    expect(failed).toMatch(/Contact the customer directly/);
    expect(emailOutcomeText({ status: "suppressed", notificationId: id }, "the reason")).toMatch(/was not sent/);
    // A duplicate may have been suppressed or stuck earlier: never claim it was delivered.
    const duplicate = emailOutcomeText({ status: "duplicate", notificationId: id }, "the reason");
    expect(duplicate).toMatch(/already recorded earlier/);
    expect(duplicate).not.toMatch(/already been sent|was emailed/);
  });

  it("is empty when the step sent no email", () => {
    expect(emailOutcomeText(null, "x")).toBe("");
    expect(emailOutcomeText(undefined, "x")).toBe("");
  });

  it("joins messages and prefixes warnings", () => {
    expect(operatorMessage(["Marked submitted.", "", null, "The customer was emailed."], ["receipt failed"])).toBe(
      "Marked submitted. The customer was emailed. Warning: receipt failed",
    );
  });
});

describe("supabaseEnvironment", () => {
  it("names the production and staging projects from the public URL", () => {
    expect(supabaseEnvironment("https://tnwpcprvetxtgyjuncrl.supabase.co")).toEqual({ label: "Production", ref: "tnwpcprvetxtgyjuncrl" });
    expect(supabaseEnvironment("https://iskphxoowsiuvvojswty.supabase.co")).toEqual({ label: "Staging", ref: "iskphxoowsiuvvojswty" });
    expect(supabaseEnvironment("http://127.0.0.1:54321")).toEqual({ label: "Local", ref: null });
    expect(supabaseEnvironment("https://abcdefghijklmnopqrst.supabase.co")).toEqual({ label: "Other", ref: "abcdefghijklmnopqrst" });
    expect(supabaseEnvironment(undefined)).toEqual({ label: "Not set", ref: null });
  });
});

describe("servicePriceApproval", () => {
  const price = (over: Partial<ServicePrice>): ServicePrice => ({
    id: "p",
    filingTypeCode: "annual_report",
    stateCode: null,
    entityType: null,
    serviceFeeCents: 4900,
    approved: false,
    active: true,
    ...over,
  });

  it("uses the most specific active price for each sold entity type", () => {
    const prices = [price({ id: "default", approved: true }), price({ id: "pa-llc", stateCode: "PA", entityType: "llc", approved: false })];
    expect(servicePriceApproval(prices, "PA", ["llc", "corporation"])).toEqual({ approved: 1, unapproved: 1, missing: 0 });
    expect(servicePriceApproval([price({ approved: true })], "PA", ["llc", "llc"])).toEqual({ approved: 1, unapproved: 0, missing: 0 });
    expect(servicePriceApproval([], "PA", ["llc"])).toEqual({ approved: 0, unapproved: 0, missing: 1 });
  });
});
