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

  it("every accepted value resolves to the same origin", () => {
    const base = "https://app.filewell.example";
    for (const candidate of ["/dashboard", "/a/b?c=d", "/%2F%2Fevil.com", "/.//evil.com"]) {
      const out = safeNextPath(candidate);
      expect(new URL(out, base).origin, candidate).toBe(base);
    }
  });

  // Browsers and the WHATWG URL parser strip ASCII tab/CR/LF, so "/\t/evil.com" becomes
  // "//evil.com" (another origin). safeNextPath lives in shared code (src/lib/auth/session.ts);
  // the fix is filed as a shared change request. Enable once it lands.
  it("rejects control characters that browsers strip, such as /\\t/evil.com and /\\n/evil.com", () => {
    for (const v of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/ /evil.com", "/\u0000/evil.com", "/\\/evil.com"]) {
      expect(safeNextPath(v)).toBe("/dashboard");
    }
    // Query strings survive (the proxy relies on this).
    expect(safeNextPath("/file/start?mode=track")).toBe("/file/start?mode=track");
  });
});
