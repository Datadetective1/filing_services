import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { OWNER_CHECK_KEYS, OWNER_CHECKS, OWNER_CHECKS_PREAMBLE } from "@/lib/admin/owner-checks";
import { WA_CERTIFICATION_TEXT } from "@/lib/compliance/states/washington";

vi.mock("server-only", () => ({}));
const { authorizationText } = await import("@/lib/filings/customer");

/** The page must carry docs/OWNER_CHECKS.md word for word: no invented or reworded text. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const doc = norm(readFileSync("docs/OWNER_CHECKS.md", "utf8").replace(/\|/g, " "));

function fragments(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^- /, "").trim())
    .filter(Boolean);
}

describe("owner checks page content", () => {
  it("every line on the page appears verbatim in docs/OWNER_CHECKS.md", () => {
    const strings: string[] = [...OWNER_CHECKS_PREAMBLE];
    for (const st of OWNER_CHECKS) {
      for (const sec of st.sections) {
        strings.push(sec.title, ...sec.intro, ...(sec.body ?? []), ...(sec.outro ?? []));
        for (const item of sec.items) {
          if (item.columns) strings.push(...item.columns.map((c) => c.value));
          else strings.push(item.text);
          if (item.stop) strings.push(item.stop);
        }
      }
    }
    for (const s of strings) for (const f of fragments(s)) expect(doc, f).toContain(norm(f));
  });

  it("has separate Washington, Nevada and Utah sections covering every checklist line", () => {
    expect(OWNER_CHECKS.map((s) => s.stateCode)).toEqual(["WA", "NV", "UT"]);
    const wa = OWNER_CHECKS[0].sections[0].items;
    expect(wa).toHaveLength(14);
    expect(OWNER_CHECKS[1].sections.map((s) => s.items.length)).toEqual([3, 4]);
    expect(OWNER_CHECKS[2].sections.map((s) => s.items.length)).toEqual([4, 4]);
    expect(OWNER_CHECK_KEYS.size).toBe(14 + 2 + 3 + 4 + 4 + 4);
    for (const k of OWNER_CHECK_KEYS) expect(k).toMatch(/^[a-z0-9_.-]{1,80}$/);
  });

  it("the counsel text shown is the shipped authorization text, identical to the document", () => {
    const text = authorizationText({
      businessName: "[Business legal name]",
      stateName: "Washington",
      filingName: "Annual Report",
      brand: "Filewell",
      state: { filingAgent: "Amary Coulibaly, sole proprietor", certificationText: WA_CERTIFICATION_TEXT },
    });
    expect(doc).toContain(norm(text));
  });
});
