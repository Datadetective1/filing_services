import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServicePrice } from "@/lib/domain/pricing";

const prices: ServicePrice[] = [];
vi.mock("@/lib/filings/rules-db", () => ({ listActivePrices: vi.fn(async () => prices) }));

const KEYS = ["VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV", "NEXT_PUBLIC_ALLOW_INDEXING"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  prices.length = 0;
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function quoteWith(approved: boolean, vars: Partial<Record<(typeof KEYS)[number], string>>) {
  Object.assign(process.env, vars);
  prices.push({ id: "price-pa", filingTypeCode: "annual_report", stateCode: "PA", entityType: null, serviceFeeCents: 4900, approved, active: true });
  const { publicQuote } = await import("@/lib/compliance/public-quote");
  const { findRule } = await import("@/lib/compliance/registry");
  const rule = findRule("PA", "llc", "annual_report", false);
  if (!rule) throw new Error("PA LLC rule missing");
  return publicQuote(rule);
}

describe("publicQuote price approval", () => {
  it("previews a provisional price on staging", async () => {
    const q = await quoteWith(false, { VERCEL_ENV: "preview" });
    expect(q).toMatchObject({ governmentFeeCents: 700, serviceFeeCents: 4900, totalCents: 5600, servicePriceApproved: false });
  });

  it("hides a provisional price on the production deployment even while indexing is off", async () => {
    expect(await quoteWith(false, { VERCEL_ENV: "production", NEXT_PUBLIC_ALLOW_INDEXING: "false" })).toBeNull();
  });

  it("shows an approved price on production", async () => {
    const q = await quoteWith(true, { VERCEL_ENV: "production" });
    expect(q).toMatchObject({ totalCents: 5600, servicePriceApproved: true });
  });
});
