import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A cookie jar standing in for next/headers, and a Supabase client whose code exchange we control.
const jar = new Map<string, string>();
let exchangeError: { message: string } | null = null;
let signedIn = false;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({ error: exchangeError }),
      getUser: async () => ({ data: { user: signedIn ? { id: "u1", email: "a@example.com", email_confirmed_at: "x" } : null }, error: null }),
    },
  }),
}));
vi.mock("@/lib/registered-agent/sales", async (orig) => ({
  ...(await orig<typeof import("@/lib/registered-agent/sales")>()),
  businessServicesPagesEnabled: () => true,
}));

const NEW_BUSINESS = "/dashboard/services/new-business";

beforeEach(() => {
  jar.clear();
  exchangeError = null;
  signedIn = false;
});

async function confirm(query: string) {
  const { GET } = await import("@/app/auth/confirm/route");
  const res = await GET(new NextRequest(`https://www.getfilewell.com/auth/confirm${query}`));
  return new URL(res.headers.get("location") ?? "");
}

describe("email confirmation keeps the registered agent order", () => {
  it("lands on the order when the link works", async () => {
    const to = await confirm(`?next=${encodeURIComponent(NEW_BUSINESS)}&code=abc`);
    expect(to.pathname).toBe(NEW_BUSINESS);
  });

  it("a link already used (opened first on a phone) sends to sign in with the order kept", async () => {
    exchangeError = { message: "invalid flow state" };
    const to = await confirm(`?next=${encodeURIComponent(NEW_BUSINESS)}&code=abc`);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("error")).toBe("link");
    expect(to.searchParams.get("next")).toBe(NEW_BUSINESS);
  });

  it("an error redirect with no code still keeps the order", async () => {
    const to = await confirm(`?next=${encodeURIComponent(NEW_BUSINESS)}&error=access_denied`);
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("next")).toBe(NEW_BUSINESS);
  });

  it("falls back to the target remembered at sign-up when the link lost it", async () => {
    jar.set("fw_after_auth", "/dashboard/services/start");
    const to = await confirm("?code=abc");
    expect(to.pathname).toBe("/dashboard/services/start");
    expect(jar.has("fw_after_auth")).toBe(false);
  });

  it("password reset failures don't carry a next", async () => {
    exchangeError = { message: "expired" };
    const to = await confirm("?next=%2Freset-password&code=abc");
    expect(to.pathname).toBe("/login");
    expect(to.searchParams.get("next")).toBeNull();
  });

  it("never follows an off-site target", async () => {
    const to = await confirm(`?next=${encodeURIComponent("//evil.com")}&code=abc`);
    expect(to.origin).toBe("https://www.getfilewell.com");
    expect(to.pathname).toBe("/dashboard");
  });
});

describe("remembered target", () => {
  it("only fills in for the plain default", async () => {
    const { pickAfterAuth } = await import("@/lib/auth/after-auth");
    expect(pickAfterAuth("/dashboard", NEW_BUSINESS)).toBe(NEW_BUSINESS);
    expect(pickAfterAuth("/file/1/checkout", NEW_BUSINESS)).toBe("/file/1/checkout");
    expect(pickAfterAuth("/dashboard", null)).toBe("/dashboard");
  });

  it("is stored for an order and not for the default or a reset", async () => {
    const { readAfterAuth, rememberAfterAuth } = await import("@/lib/auth/after-auth");
    await rememberAfterAuth("/dashboard");
    await rememberAfterAuth("/reset-password");
    expect(await readAfterAuth()).toBeNull();
    await rememberAfterAuth(NEW_BUSINESS);
    expect(await readAfterAuth()).toBe(NEW_BUSINESS);
    jar.set("fw_after_auth", "https://evil.com");
    expect(await readAfterAuth()).toBeNull();
  });
});

describe("registered agent buttons", () => {
  async function start(query: string) {
    const { GET } = await import("@/app/(marketing)/registered-agent/start/route");
    const res = await GET(new NextRequest(`https://www.getfilewell.com/registered-agent/start${query}`));
    return { res, to: res.headers.get("location") ? new URL(res.headers.get("location") ?? "") : null };
  }

  it("new business, signed out: create an account that returns to the order", async () => {
    const { to } = await start("?for=new");
    expect(to?.pathname).toBe("/signup");
    expect(to?.searchParams.get("next")).toBe(NEW_BUSINESS);
    expect(jar.get("fw_service_intent")).toBe("registered_agent");
  });

  it("new business, signed in: straight to the order", async () => {
    signedIn = true;
    const { to } = await start("?for=new");
    expect(to?.pathname).toBe(NEW_BUSINESS);
  });

  it("existing business: the lookup, remembering it's for an agent", async () => {
    const { to } = await start("?state=tx");
    expect(to?.pathname).toBe("/find");
    expect(to?.searchParams.get("state")).toBe("TX");
    expect(jar.get("fw_service_intent")).toBe("registered_agent");
  });

  it("a prefetch sets nothing", async () => {
    const { GET } = await import("@/app/(marketing)/registered-agent/start/route");
    const res = await GET(new NextRequest("https://www.getfilewell.com/registered-agent/start?for=new", { headers: { "next-router-prefetch": "1" } }));
    expect(res.status).toBe(204);
    expect(jar.size).toBe(0);
  });
});

describe("header button", () => {
  it("starts the agent order on the registered agent pages only", async () => {
    const { headerCta } = await import("@/components/layout/header-cta");
    expect(headerCta("/registered-agent", true)).toEqual({ href: "/registered-agent/start", label: "Get a registered agent" });
    expect(headerCta("/registered-agent/texas", true).href).toBe("/registered-agent/start");
    expect(headerCta("/", true)).toEqual({ href: "/find", label: "Find my business" });
    expect(headerCta("/registered-agent", false).href).toBe("/find");
  });
});

describe("renewal line", () => {
  it("keeps the state's capital and doesn't say per year twice", async () => {
    const { renewalLabel } = await import("@/components/services/quote-summary");
    expect(renewalLabel("Registered agent service in Texas, per year")).toBe("registered agent service in Texas");
    expect(renewalLabel("Registered agent service in New Mexico")).toBe("registered agent service in New Mexico");
  });
});
