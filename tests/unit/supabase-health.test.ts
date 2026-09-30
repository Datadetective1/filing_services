import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createAnonClient: vi.fn() }));

const { probeSupabase } = await import("@/lib/supabase/health");

describe("probeSupabase", () => {
  it("reports an accepted key", async () => {
    expect(await probeSupabase(async () => ({ error: null }))).toEqual({ ok: true, detail: null });
  });

  it("reports a key from another project as rejected, without echoing the key", async () => {
    const r = await probeSupabase(async () => ({ error: { message: "Invalid API key" } }));
    expect(r).toEqual({ ok: false, detail: "Invalid API key" });
  });

  it("treats a network failure as rejected", async () => {
    const r = await probeSupabase(async () => {
      throw new Error("fetch failed");
    });
    expect(r).toEqual({ ok: false, detail: "fetch failed" });
  });
});
