import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, sanitizeFileName, sniffMime } from "@/lib/documents/storage";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("sniffMime", () => {
  it("detects PDF, PNG and JPEG from magic bytes", () => {
    expect(sniffMime(ascii("%PDF-1.7\n%...."))).toBe("application/pdf");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10))).toBe("image/jpeg");
  });

  it("returns null for anything else, ignoring what the file claims to be", () => {
    expect(sniffMime(new Uint8Array())).toBeNull();
    expect(sniffMime(ascii("GIF89a"))).toBeNull();
    expect(sniffMime(ascii("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(ascii("MZ\x90\x00"))).toBeNull(); // Windows executable
    expect(sniffMime(ascii("PK\x03\x04"))).toBeNull(); // zip / docx
    expect(sniffMime(ascii("%PDF"))).toBeNull(); // truncated header
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull(); // too short for PNG
    expect(sniffMime(ascii(" %PDF-1.7"))).toBeNull(); // magic must be at offset 0
  });

  it("caps uploads at 4 MB: under Vercel's 4.5 MB body limit and the 10 MB database check", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_DOCUMENT_BYTES).toBeLessThan(4.5 * 1024 * 1024);
    expect(MAX_DOCUMENT_BYTES).toBeLessThanOrEqual(10_485_760);
  });
});

describe("sanitizeFileName", () => {
  it("strips directory traversal and path separators", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..\\..\\windows\\win.ini")).toBe("win.ini");
    expect(sanitizeFileName("/absolute/path/receipt.pdf")).toBe("receipt.pdf");
    expect(sanitizeFileName("..")).toBe("document");
    expect(sanitizeFileName("../")).toBe("document");
  });

  it("keeps ordinary names and replaces unsafe characters", () => {
    expect(sanitizeFileName("receipt.pdf")).toBe("receipt.pdf");
    expect(sanitizeFileName("State Receipt (2026).pdf")).toBe("State-Receipt-2026-.pdf");
    expect(sanitizeFileName('a<b>c:"d|e?f*.png')).toBe("a-b-c-d-e-f-.png");
    expect(sanitizeFileName("evil.pdf\u0000.exe")).toBe("evil.pdf-.exe");
  });

  it("removes leading dots and dashes (no hidden files, no option-like names)", () => {
    expect(sanitizeFileName(".htaccess")).toBe("htaccess");
    expect(sanitizeFileName("--rm -rf.pdf")).toBe("rm-rf.pdf");
  });

  it("falls back to a default name and limits length", () => {
    expect(sanitizeFileName("")).toBe("document");
    expect(sanitizeFileName("   ")).toBe("document");
    expect(sanitizeFileName(`${"a".repeat(300)}.pdf`)).toHaveLength(120);
  });

  it("never returns separators or a traversal prefix", () => {
    const attacks = ["../../../../x", "..\\..\\x", "./.././x", "%2e%2e/%2e%2e/x", "a/../../b", "....//....//x"];
    for (const a of attacks) {
      const out = sanitizeFileName(a);
      expect(out, a).not.toMatch(/[\\/]/);
      expect(out.startsWith("."), a).toBe(false);
      expect(out.length, a).toBeGreaterThan(0);
    }
  });
});
