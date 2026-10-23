import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A state status may add a status-based fee (Washington's $25 delinquency fee) only from
 * that state's own official source, recorded within the freshness window and never dated
 * in the future. Utah's status is never read until the Division confirms its late-fee label.
 */

let row: { status_raw: string; status_checked_at: string; source: string } | null = null;
const calls: [string, ...unknown[]][] = [];
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "in", "not", "gte", "lte", "order", "limit"])
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return chain;
    };
  chain.maybeSingle = async () => ({ data: row, error: null });
  return { createAdminClient: () => chain };
});

const { knownStateStatus, STATUS_SOURCE_BY_STATE } = await import("@/lib/registry/state-status");

afterEach(() => {
  row = null;
  calls.length = 0;
});

const now = new Date("2026-11-15T12:00:00Z");

describe("knownStateStatus", () => {
  it("reads only the state's own source, bounded on both sides", async () => {
    row = { status_raw: "Delinquent", status_checked_at: "2026-11-14T12:00:00Z", source: "wa_ccfs_export" };
    expect(await knownStateStatus("WA", "604111222", now)).toMatchObject({ value: "Delinquent", source: "wa_ccfs_export" });
    expect(calls).toContainEqual(["eq", "source", "wa_ccfs_export"]);
    expect(calls.some((c) => c[0] === "lte" && c[1] === "status_checked_at")).toBe(true);
  });

  it("a record from another state's source never counts", async () => {
    row = { status_raw: "Delinquent", status_checked_at: "2026-11-14T12:00:00Z", source: "nv_official_export" };
    expect(await knownStateStatus("WA", "604111222", now)).toBeNull();
  });

  it("a future-dated or stale record never counts", async () => {
    row = { status_raw: "Delinquent", status_checked_at: "2099-01-01T12:00:00Z", source: "wa_ccfs_export" };
    expect(await knownStateStatus("WA", "604111222", now)).toBeNull();
    row = { status_raw: "Delinquent", status_checked_at: "2026-10-01T12:00:00Z", source: "wa_ccfs_export" };
    expect(await knownStateStatus("WA", "604111222", now)).toBeNull();
  });

  it("Utah and Pennsylvania statuses are never read (Utah's late-fee label is unconfirmed)", async () => {
    expect(STATUS_SOURCE_BY_STATE.UT).toBeUndefined();
    row = { status_raw: "Delinquent", status_checked_at: "2026-11-14T12:00:00Z", source: "ut_official_export" };
    expect(await knownStateStatus("UT", "1234567-0160", now)).toBeNull();
    expect(await knownStateStatus("PA", "1234567", now)).toBeNull();
    expect(calls).toEqual([]);
  });
});
