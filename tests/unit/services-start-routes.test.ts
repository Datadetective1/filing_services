import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two hand-off routes: the public "Get started" remembers the visitor came for a
 * registered agent and opens the lookup in their state; after signup, the lookup becomes a
 * business and the order opens. A prefetch never creates anything.
 */

const h = vi.hoisted(() => ({
  intent: [] as string[],
  user: { id: "u1", email: "a@example.test", emailConfirmed: true } as null | { id: string; email: string; emailConfirmed: boolean },
  lookup: { stateCode: "TX", entityType: "llc", legalName: "Acme LLC", formationDate: null, entityNumber: null, isForeign: false, isNonprofit: false, alreadyFiledThisYear: false, registryEntityNumber: null } as unknown,
  existing: null as string | null,
  added: [] as unknown[],
  cleared: [] as string[],
}));

vi.mock("@/lib/services/intent", () => ({
  setServiceIntent: vi.fn(async (i: string) => void h.intent.push(i)),
  clearServiceIntent: vi.fn(async () => void h.cleared.push("intent")),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => h.user) }));
vi.mock("@/lib/lookup/pending", () => ({
  readPendingLookup: vi.fn(async () => h.lookup),
  clearPendingLookup: vi.fn(async () => void h.cleared.push("lookup")),
}));
vi.mock("@/app/(marketing)/find/lookup-extras", () => ({
  readLookupHomeJurisdiction: vi.fn(async () => null),
  clearLookupHomeJurisdiction: vi.fn(async () => void h.cleared.push("home")),
}));
vi.mock("@/lib/filings/find-existing", () => ({ findExistingBusiness: vi.fn(async () => h.existing) }));
vi.mock("@/lib/services/business", () => ({
  addBusinessForService: vi.fn(async (_u: unknown, input: unknown) => (h.added.push(input), "b-new")),
}));

beforeEach(() => {
  h.intent = [];
  h.added = [];
  h.cleared = [];
  h.existing = null;
  h.user = { id: "u1", email: "a@example.test", emailConfirmed: true };
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "preview");
});
afterEach(() => vi.unstubAllEnvs());

const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${path}`, { headers });

describe("GET /registered-agent/start", () => {
  it("remembers the intent and opens the lookup in the chosen state", async () => {
    const { GET } = await import("@/app/(marketing)/registered-agent/start/route");
    const res = await GET(req("/registered-agent/start?state=tx"));
    expect(res.headers.get("location")).toBe("http://localhost/find?state=TX");
    expect(h.intent).toEqual(["registered_agent"]);
  });

  it("ignores an unknown state and does nothing on production before launch", async () => {
    const { GET } = await import("@/app/(marketing)/registered-agent/start/route");
    expect((await GET(req("/registered-agent/start?state=ZZ"))).headers.get("location")).toBe("http://localhost/find");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    h.intent = [];
    expect((await GET(req("/registered-agent/start?state=TX"))).headers.get("location")).toBe("http://localhost/find");
    expect(h.intent).toEqual([]);
  });
});

describe("GET /annual-report/start", () => {
  it("forgets the agent intent and reopens the lookup, or the result already found", async () => {
    const { GET } = await import("@/app/(marketing)/annual-report/start/route");
    expect((await GET(req("/annual-report/start"))).headers.get("location")).toBe("http://localhost/find");
    expect((await GET(req("/annual-report/start?next=result"))).headers.get("location")).toBe("http://localhost/find/result");
    expect(h.cleared).toEqual(["intent", "intent"]);
  });

  it("does nothing on a prefetch", async () => {
    const { GET } = await import("@/app/(marketing)/annual-report/start/route");
    const res = await GET(req("/annual-report/start", { "next-router-prefetch": "1" }));
    expect(res.status).toBe(204);
    expect(h.cleared).toEqual([]);
  });
});

describe("GET /dashboard/services/start", () => {
  it("adds the looked-up business and opens its order, clearing the lookup", async () => {
    const { GET } = await import("@/app/(app)/dashboard/services/start/route");
    const res = await GET(req("/dashboard/services/start"));
    expect(res.headers.get("location")).toBe("http://localhost/dashboard/services/new?business=b-new");
    expect(h.added).toEqual([expect.objectContaining({ legalName: "Acme LLC", stateCode: "TX" })]);
    expect(h.cleared.sort()).toEqual(["home", "intent", "lookup"]);
  });

  it("reuses a business the customer already has", async () => {
    h.existing = "b-old";
    const { GET } = await import("@/app/(app)/dashboard/services/start/route");
    expect((await GET(req("/dashboard/services/start"))).headers.get("location")).toBe("http://localhost/dashboard/services/new?business=b-old");
    expect(h.added).toEqual([]);
  });

  it("sends a signed-out visitor to sign in and back", async () => {
    h.user = null;
    const { GET } = await import("@/app/(app)/dashboard/services/start/route");
    expect((await GET(req("/dashboard/services/start"))).headers.get("location")).toBe("http://localhost/login?next=%2Fdashboard%2Fservices%2Fstart");
  });

  it("never creates anything on a prefetch", async () => {
    const { GET } = await import("@/app/(app)/dashboard/services/start/route");
    const res = await GET(req("/dashboard/services/start", { "next-router-prefetch": "1" }));
    expect(res.status).toBe(204);
    expect(h.added).toEqual([]);
  });
});
