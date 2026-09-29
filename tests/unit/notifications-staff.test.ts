import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const staffQuery = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "staff_members") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({ eq: (col: string, val: unknown) => staffQuery(col, val) }),
      };
    },
  }),
}));

const sendNotification = vi.fn();
vi.mock("@/lib/notifications/send", () => ({ sendNotification: (...args: unknown[]) => sendNotification(...args) }));

const loadFilingContext = vi.fn();
vi.mock("@/lib/filings/context", () => ({ loadFilingContext: (...args: unknown[]) => loadFilingContext(...args) }));

const { customerMessageAlertKey, notifyStaff, notifyStaffOfCustomerMessage, staffDedupeKey } = await import("@/lib/notifications/staff");

const base = {
  templateKey: "staff_new_paid_order",
  vars: { company_name: "Acme LLC" },
  dedupeKey: "staff_new_paid_order:order-1",
  ctaPath: "/admin/filings/f1",
  filingId: "f1",
  businessId: "b1",
};

beforeEach(() => {
  staffQuery.mockReset();
  sendNotification.mockReset();
  loadFilingContext.mockReset();
  sendNotification.mockImplementation(async (i: { dedupeKey: string }) => ({ status: "sent", notificationId: i.dedupeKey }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyStaff", () => {
  it("sends one notification per active staff member, each with its own dedupe key", async () => {
    staffQuery.mockResolvedValue({ data: [{ user_id: "s1" }, { user_id: "s2" }], error: null });
    const results = await notifyStaff(base);
    expect(staffQuery).toHaveBeenCalledWith("active", true);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification.mock.calls.map((c) => c[0].userId)).toEqual(["s1", "s2"]);
    expect(sendNotification.mock.calls.map((c) => c[0].dedupeKey)).toEqual([
      "staff_new_paid_order:order-1:staff:s1",
      "staff_new_paid_order:order-1:staff:s2",
    ]);
    expect(sendNotification.mock.calls[0][0]).toMatchObject({
      templateKey: "staff_new_paid_order",
      ctaPath: "/admin/filings/f1",
      filingId: "f1",
      businessId: "b1",
      vars: { company_name: "Acme LLC" },
    });
    expect(results).toHaveLength(2);
  });

  it("builds stable per-staff dedupe keys", () => {
    expect(staffDedupeKey("staff_customer_message:m1", "u9")).toBe("staff_customer_message:m1:staff:u9");
  });

  it("does nothing when there is no active staff", async () => {
    staffQuery.mockResolvedValue({ data: [], error: null });
    await expect(notifyStaff(base)).resolves.toEqual([]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("never throws when the staff lookup fails", async () => {
    staffQuery.mockResolvedValue({ data: null, error: { message: "db down" } });
    await expect(notifyStaff(base)).resolves.toEqual([]);
    staffQuery.mockRejectedValue(new Error("network"));
    await expect(notifyStaff(base)).resolves.toEqual([]);
  });

  it("keeps alerting the other staff when one send throws", async () => {
    staffQuery.mockResolvedValue({ data: [{ user_id: "s1" }, { user_id: "s2" }], error: null });
    sendNotification.mockRejectedValueOnce(new Error("claim failed"));
    const results = await notifyStaff(base);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(results).toEqual([{ status: "sent", notificationId: "staff_new_paid_order:order-1:staff:s2" }]);
  });
});

describe("notifyStaffOfCustomerMessage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups alerts per filing per UTC hour", () => {
    expect(customerMessageAlertKey("f1", new Date("2026-09-29T14:05:00Z"))).toBe("staff_customer_message:f1:2026-09-29T14");
    expect(customerMessageAlertKey("f1", new Date("2026-09-29T14:59:59Z"))).toBe("staff_customer_message:f1:2026-09-29T14");
    expect(customerMessageAlertKey("f1", new Date("2026-09-29T15:00:00Z"))).toBe("staff_customer_message:f1:2026-09-29T15");
    expect(customerMessageAlertKey("f2", new Date("2026-09-29T14:05:00Z"))).toBe("staff_customer_message:f2:2026-09-29T14");
  });

  it("alerts staff with the filing's hourly key, pointing at the admin filing page", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T14:05:00Z"));
    loadFilingContext.mockResolvedValue({ filing: { id: "f1", businessId: "b1" }, vars: { company_name: "Acme LLC" } });
    staffQuery.mockResolvedValue({ data: [{ user_id: "s1" }], error: null });
    await notifyStaffOfCustomerMessage("f1", "msg-7");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "s1",
        templateKey: "staff_customer_message",
        dedupeKey: "staff_customer_message:f1:2026-09-29T14:staff:s1",
        ctaPath: "/admin/filings/f1",
        filingId: "f1",
        businessId: "b1",
      }),
    );
  });

  it("reuses the same dedupe key for every message on a filing within the hour, so only the first one emails", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    loadFilingContext.mockResolvedValue({ filing: { id: "f1", businessId: "b1" }, vars: {} });
    staffQuery.mockResolvedValue({ data: [{ user_id: "s1" }], error: null });
    vi.setSystemTime(new Date("2026-09-29T14:05:00Z"));
    await notifyStaffOfCustomerMessage("f1", "msg-1");
    vi.setSystemTime(new Date("2026-09-29T14:40:00Z"));
    await notifyStaffOfCustomerMessage("f1", "msg-2");
    vi.setSystemTime(new Date("2026-09-29T15:01:00Z"));
    await notifyStaffOfCustomerMessage("f1", "msg-3");
    expect(sendNotification.mock.calls.map((c) => c[0].dedupeKey)).toEqual([
      "staff_customer_message:f1:2026-09-29T14:staff:s1",
      "staff_customer_message:f1:2026-09-29T14:staff:s1",
      "staff_customer_message:f1:2026-09-29T15:staff:s1",
    ]);
    // The message id never reaches the key, so 20 messages in an hour cannot mean 20 alerts.
    expect(sendNotification.mock.calls.some((c) => String(c[0].dedupeKey).includes("msg-"))).toBe(false);
  });

  it("never throws, even if the filing cannot be loaded", async () => {
    loadFilingContext.mockRejectedValue(new Error("db down"));
    await expect(notifyStaffOfCustomerMessage("f1", "msg-7")).resolves.toBeUndefined();
    loadFilingContext.mockResolvedValue(null);
    await expect(notifyStaffOfCustomerMessage("f1", "msg-7")).resolves.toBeUndefined();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
