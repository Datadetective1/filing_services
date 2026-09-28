import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSignedToken, verifySignedToken } from "@/lib/security/tokens";

const APP_SECRET = process.env.APP_SIGNING_SECRET!;

/** Build a token by hand with the same scheme, to test payload handling behind a valid MAC. */
function handMade(purpose: string, payload: unknown, secret = APP_SECRET) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(`${purpose}.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("signed tokens", () => {
  it("round-trips a payload with an expiry", () => {
    const token = createSignedToken("unsubscribe", { uid: "user-1" }, 3600);
    const payload = verifySignedToken<{ uid: string; exp: number }>("unsubscribe", token);
    expect(payload?.uid).toBe("user-1");
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("supports an explicit secret", () => {
    const token = createSignedToken("lookup", { s: "PA" }, 60, "explicit-secret-0123456789abcdef");
    expect(verifySignedToken("lookup", token, "explicit-secret-0123456789abcdef")).toMatchObject({ s: "PA" });
    expect(verifySignedToken("lookup", token)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createSignedToken("unsubscribe", { uid: "user-1" }, 3600);
    const [, mac] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ uid: "user-2", exp: 9_999_999_999 })).toString("base64url");
    expect(verifySignedToken("unsubscribe", `${forgedBody}.${mac}`)).toBeNull();
    const flipped = token[0] === "A" ? `B${token.slice(1)}` : `A${token.slice(1)}`;
    expect(verifySignedToken("unsubscribe", flipped)).toBeNull();
    expect(verifySignedToken("unsubscribe", `${token.split(".")[0]}.${mac.slice(0, -2)}`)).toBeNull();
  });

  it("rejects a token minted for a different purpose", () => {
    const token = createSignedToken("lookup", { uid: "user-1" }, 3600);
    expect(verifySignedToken("unsubscribe", token)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSignedToken("unsubscribe", { uid: "user-1" }, 3600, "another-secret-0123456789abcdef!!");
    expect(verifySignedToken("unsubscribe", token)).toBeNull();
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
    const token = createSignedToken("unsubscribe", { uid: "user-1" }, 60);
    vi.setSystemTime(new Date("2026-09-27T12:00:59Z"));
    expect(verifySignedToken("unsubscribe", token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-09-27T12:01:01Z"));
    expect(verifySignedToken("unsubscribe", token)).toBeNull();
    expect(verifySignedToken("unsubscribe", createSignedToken("unsubscribe", {}, -1))).toBeNull();
  });

  it("requires a numeric expiry even behind a valid signature", () => {
    expect(verifySignedToken("unsubscribe", handMade("unsubscribe", { uid: "u" }))).toBeNull();
    expect(verifySignedToken("unsubscribe", handMade("unsubscribe", { uid: "u", exp: "never" }))).toBeNull();
    expect(
      verifySignedToken("unsubscribe", handMade("unsubscribe", { uid: "u", exp: Math.floor(Date.now() / 1000) + 60 })),
    ).toMatchObject({ uid: "u" });
  });

  it("rejects malformed input", () => {
    for (const t of [null, undefined, "", "abc", "a.", ".b", "a.b", "x".repeat(5000)]) {
      expect(verifySignedToken("unsubscribe", t)).toBeNull();
    }
    const notJsonBody = Buffer.from("not json").toString("base64url");
    const mac = createHmac("sha256", APP_SECRET).update(`unsubscribe.${notJsonBody}`).digest("base64url");
    expect(verifySignedToken("unsubscribe", `${notJsonBody}.${mac}`)).toBeNull();
  });
});
