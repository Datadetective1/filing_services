import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Processing is not under test here and would need a database.
vi.mock("@/lib/payments/process-event", () => ({
  processPaymentEvent: vi.fn(async () => ({ status: "processed", result: "ok" })),
}));

const KEYS = ["VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "PAYMENTS_PROVIDER", "ALLOW_REAL_PAYMENTS_IN_TESTS"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  vi.resetModules();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function post(provider: string, vars: Partial<Record<(typeof KEYS)[number], string>>, body = "{}", headers: Record<string, string> = {}) {
  Object.assign(process.env, vars);
  const { POST } = await import("@/app/api/webhooks/payments/[provider]/route");
  const request = new NextRequest(`http://localhost/api/webhooks/payments/${provider}`, { method: "POST", body, headers });
  return POST(request, { params: Promise.resolve({ provider }) } as never);
}

describe("payment webhook route", () => {
  it("answers 503 (not an unhandled 500) when payments are not configured, e.g. sandbox on production", async () => {
    const res = await post("sandbox", { ALLOW_REAL_PAYMENTS_IN_TESTS: "true", VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "payments not configured" });
  });

  it("answers 404 for a provider name that doesn't exist, even when payments are off", async () => {
    const res = await post("paypal", { ALLOW_REAL_PAYMENTS_IN_TESTS: "true", VERCEL_ENV: "production", PAYMENTS_PROVIDER: "sandbox" });
    expect(res.status).toBe(404);
  });

  it("answers 404 for a known provider that isn't the active one", async () => {
    const res = await post("stripe", { PAYMENTS_PROVIDER: "sandbox" });
    expect(res.status).toBe(404);
  });

  it("still rejects an unsigned sandbox event with 400", async () => {
    const res = await post("sandbox", { PAYMENTS_PROVIDER: "sandbox" }, JSON.stringify({ id: "sbx_evt_x", type: "checkout.session.completed", created: 1, data: {} }));
    expect(res.status).toBe(400);
  });
});
