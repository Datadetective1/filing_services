import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly and seed reference data", async () => {
    const db = await createTestDb();
    const states = await db.query<{ n: number }>("select count(*)::int as n from public.states");
    expect(states.rows[0].n).toBe(51);
    const versions = await db.query<{ n: number }>("select count(*)::int as n from public.state_rule_versions where verification_status = 'verified'");
    expect(versions.rows[0].n).toBe(8);
  });
});
