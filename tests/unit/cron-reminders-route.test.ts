import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The daily cron: CRON_SECRET still gates it, and the stuck-payment alert runs after the reminder cycles. */

const h = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/reminders/engine", () => ({ runReminderCycle: vi.fn(async () => (h.calls.push("reminders"), { sent: 0 })) }));
vi.mock("@/lib/reminders/subscribers", () => ({
  runSubscriberReminderCycle: vi.fn(async () => {
    h.calls.push("subscribers");
    throw new Error("subscriber cycle failed");
  }),
}));
vi.mock("@/lib/payments/review-alerts", () => ({
  alertStaffOfPaymentsNeedingReview: vi.fn(async () => (h.calls.push("payment_review"), { cases: 1, sent: 1, duplicate: 0, failed: 0, suppressed: 0 })),
}));

const SECRET = "unit-test-cron-secret-0123456789";

beforeEach(() => {
  h.calls = [];
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function get(authorization?: string) {
  const { GET } = await import("@/app/api/cron/reminders/route");
  return GET(new NextRequest("http://localhost/api/cron/reminders", { headers: authorization ? { authorization } : {} }));
}

describe("GET /api/cron/reminders", () => {
  it("refuses a request without the cron secret, and sends no staff alert", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong-secret-of-the-same-size-x")).status).toBe(401);
    expect(h.calls).toEqual([]);
  });

  it("runs the reminder cycles, then the payment review alert, even if the subscriber cycle failed", async () => {
    const res = await get(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(h.calls).toEqual(["reminders", "subscribers", "payment_review"]);
    expect(await res.json()).toEqual({
      ok: true,
      summary: { sent: 0 },
      subscribers: null,
      paymentReview: { cases: 1, sent: 1, duplicate: 0, failed: 0, suppressed: 0 },
    });
  });
});
