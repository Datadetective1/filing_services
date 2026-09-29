import { beforeEach, describe, expect, it, vi } from "vitest";

// customerReply wiring: the staff alert gets the new message's id and filing, and is
// skipped when the reply is refused or fails to save.

const state = {
  filing: { id: "f1", status: "ready_for_review", user_id: "user-1" } as Record<string, unknown> | null,
  message: { data: { id: "msg-9" } as unknown, error: null as unknown },
  inserts: [] as Record<string, unknown>[],
};

function userQuery(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    insert: (payload: Record<string, unknown>) => {
      state.inserts.push({ table, ...payload });
      return chain;
    },
    maybeSingle: () => Promise.resolve({ data: table === "filings" ? state.filing : null, error: null }),
    single: () => Promise.resolve(table === "messages" ? state.message : { data: null, error: null }),
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => userQuery(table) }),
  createAnonClient: () => ({}),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));

const rateLimit = vi.fn();
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const notifyStaffOfCustomerMessage = vi.fn();
vi.mock("@/lib/notifications/staff", () => ({
  notifyStaffOfCustomerMessage: (...a: unknown[]) => notifyStaffOfCustomerMessage(...a),
}));

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("@/lib/security/request", () => ({ clientIpHash: async () => "ip", userAgent: async () => "ua" }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn(async () => {}) }));
vi.mock("@/lib/payments", () => ({ getPaymentProvider: vi.fn(), requiresApprovedPrice: vi.fn() }));
vi.mock("@/lib/payments/process-event", () => ({ afterPaymentSucceeded: vi.fn() }));
vi.mock("@/lib/reminders/engine", () => ({ ensureRemindersForRequirement: vi.fn(), rollForwardRequirement: vi.fn() }));
vi.mock("@/lib/filings/rules-db", () => ({ getCurrentRuleVersion: vi.fn(), listActivePricesAdmin: vi.fn() }));

const { customerReply } = await import("@/lib/filings/customer");

const user = { id: "user-1", email: "owner@realmail.com" } as Parameters<typeof customerReply>[0];

beforeEach(() => {
  state.filing = { id: "f1", status: "ready_for_review", user_id: "user-1" };
  state.message = { data: { id: "msg-9" }, error: null };
  state.inserts = [];
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  rateLimit.mockReset().mockResolvedValue(true);
  notifyStaffOfCustomerMessage.mockReset().mockResolvedValue(undefined);
});

describe("customerReply staff alert", () => {
  it("alerts staff with the filing id and the saved message id", async () => {
    await customerReply(user, "f1", "  Is anything else needed?  ");
    expect(state.inserts).toEqual([
      expect.objectContaining({ table: "messages", filing_id: "f1", author_type: "customer", body: "Is anything else needed?" }),
    ]);
    expect(notifyStaffOfCustomerMessage).toHaveBeenCalledTimes(1);
    expect(notifyStaffOfCustomerMessage).toHaveBeenCalledWith("f1", "msg-9");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("moves a filing waiting on the customer back to review and still alerts staff", async () => {
    state.filing = { id: "f1", status: "needs_customer_action", user_id: "user-1" };
    await customerReply(user, "f1", "Here is the officer's address.");
    expect(rpc).toHaveBeenCalledWith("transition_filing", expect.objectContaining({ p_filing_id: "f1", p_to_status: "ready_for_review" }));
    expect(notifyStaffOfCustomerMessage).toHaveBeenCalledWith("f1", "msg-9");
  });

  it("sends no alert when the customer is rate limited", async () => {
    rateLimit.mockResolvedValue(false);
    await expect(customerReply(user, "f1", "hello")).rejects.toThrow(/Wait a few minutes/);
    expect(state.inserts).toEqual([]);
    expect(notifyStaffOfCustomerMessage).not.toHaveBeenCalled();
  });

  it("sends no alert when the filing isn't the customer's or the message fails to save", async () => {
    state.filing = null;
    await expect(customerReply(user, "f1", "hello")).rejects.toThrow("Filing not found");
    state.filing = { id: "f1", status: "ready_for_review", user_id: "user-1" };
    state.message = { data: null, error: { message: "denied" } };
    await expect(customerReply(user, "f1", "hello")).rejects.toThrow("Could not send: denied");
    expect(notifyStaffOfCustomerMessage).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized messages before anything is saved", async () => {
    await expect(customerReply(user, "f1", "   ")).rejects.toThrow("Messages must be 1 to 5000 characters.");
    await expect(customerReply(user, "f1", "x".repeat(5001))).rejects.toThrow("Messages must be 1 to 5000 characters.");
    expect(state.inserts).toEqual([]);
    expect(notifyStaffOfCustomerMessage).not.toHaveBeenCalled();
  });
});
