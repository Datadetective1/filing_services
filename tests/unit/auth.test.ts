import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/session";

describe("safeNextPath", () => {
  it("accepts same-origin relative paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/file/123/checkout?step=2#pay")).toBe("/file/123/checkout?step=2#pay");
    expect(safeNextPath("/")).toBe("/");
  });

  it("falls back for empty input", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(null, "/admin")).toBe("/admin");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("//evil.com/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\/evil.com")).toBe("/dashboard");
  });

  it("rejects absolute URLs and non-path schemes", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("http://evil.com/dashboard")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("dashboard")).toBe("/dashboard");
    expect(safeNextPath(" /dashboard")).toBe("/dashboard");
  });

  it("rejects overly long paths", () => {
    expect(safeNextPath(`/${"a".repeat(299)}`)).toHaveLength(300);
    expect(safeNextPath(`/${"a".repeat(300)}`)).toBe("/dashboard");
    expect(safeNextPath(`/${"a".repeat(5000)}`)).toBe("/dashboard");
  });

  it("every accepted value resolves to the same origin and a single leading slash", () => {
    const base = "https://app.filewell.example";
    for (const candidate of ["/dashboard", "/a/b?c=d", "/%2F%2Fevil.com", "/.//evil.com", "/%2e//evil.com", "/a/..//evil.com"]) {
      const out = safeNextPath(candidate);
      expect(new URL(out, base).origin, candidate).toBe(base);
      // Next's router uses the returned string as the canonical URL, so it must never be protocol-relative.
      expect(out.startsWith("//"), candidate).toBe(false);
      expect(new URL(out, base).pathname.startsWith("//"), candidate).toBe(false);
    }
  });

  it("rejects dot segments that normalize to a protocol-relative URL", () => {
    for (const v of [
      "/.//evil.com",
      "/..//evil.com",
      "/a/..//evil.com",
      "/a/b/../..//evil.com",
      "/.//evil.com/dashboard?x=1",
      "/./\\evil.com",
      "/%2e//evil.com",
      "/%2E//evil.com",
      "/%2e%2e//evil.com",
      "/%2E%2E//evil.com",
      "/.%2e//evil.com",
      "/a/%2e%2e//evil.com",
      "/a/%2e%2e/%2e%2e//evil.com",
    ]) {
      expect(safeNextPath(v), v).toBe("/dashboard");
    }
    expect(safeNextPath("/.//evil.com", "/admin")).toBe("/admin");
  });

  it("returns the normalized path and keeps the query and fragment", () => {
    expect(safeNextPath("/file/./start?mode=track")).toBe("/file/start?mode=track");
    expect(safeNextPath("/file/123/../456/checkout#pay")).toBe("/file/456/checkout#pay");
    expect(safeNextPath("/a//b")).toBe("/a//b");
  });

  // Browsers and the WHATWG URL parser strip ASCII tab/CR/LF, so "/\t/evil.com" becomes
  // "//evil.com" (another origin).
  it("rejects control characters that browsers strip, such as /\\t/evil.com and /\\n/evil.com", () => {
    for (const v of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com", "/\u0000/evil.com", "/\\/evil.com"]) {
      expect(safeNextPath(v)).toBe("/dashboard");
    }
    // Query strings survive (the proxy relies on this).
    expect(safeNextPath("/file/start?mode=track")).toBe("/file/start?mode=track");
  });
});
