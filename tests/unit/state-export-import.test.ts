import { afterEach, describe, expect, it, vi } from "vitest";

/** Re-importing an older official export never replaces newer status evidence. */

const upserts: Record<string, unknown>[][] = [];
let existing: { entity_number: string; status_checked_at: string | null }[] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq"]) chain[m] = () => chain;
  chain.in = async () => ({ data: existing, error: null });
  chain.upsert = async (rows: Record<string, unknown>[]) => {
    upserts.push(rows);
    return { error: null };
  };
  return { createAdminClient: () => chain };
});

const { importStateExport } = await import("@/lib/acquisition/state-cohort");

afterEach(() => {
  upserts.length = 0;
  existing = [];
});

const csv = [
  "UBI#,Business Name,Business Type,Status,Expiration Date",
  "604123456,Cascade Plumbing LLC,WA LIMITED LIABILITY COMPANY,Active,10/31/2026",
  "603999888,Evergreen Holdings Inc.,WA PROFIT CORPORATION,Delinquent,09/30/2026",
].join("\r\n");

describe("importStateExport", () => {
  it("skips rows whose record on file is from a newer export", async () => {
    existing = [
      { entity_number: "604123456", status_checked_at: "2026-10-20T12:00:00Z" },
      { entity_number: "603999888", status_checked_at: "2026-10-01T12:00:00Z" },
    ];
    const r = await importStateExport("WA", csv, "2026-10-10T12:00:00Z");
    expect(r.imported).toBe(1);
    expect(r.keptNewer).toBe(1);
    expect(upserts.flat().map((x) => x.entity_number)).toEqual(["603999888"]);
  });

  it("imports everything when nothing newer is on file", async () => {
    const r = await importStateExport("WA", csv, "2026-10-10T12:00:00Z");
    expect(r).toMatchObject({ imported: 2, keptNewer: 0 });
  });
});
