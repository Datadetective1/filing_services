import { describe, expect, it } from "vitest";
import { GET as badgeGet } from "@/app/api/badge/[state]/route";
import { badgeEmbedHtml, badgeRow, badgeRows, badgeSvg, wrapText } from "@/lib/seo/badge";
import { GLOSSARY } from "@/lib/seo/glossary";

const AI_TELLS = /--|–|—/;

describe("deadline badge", () => {
  const rows = badgeRows();

  it("only offers verified states", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(badgeRow("pennsylvania")?.code).toBe("PA");
    expect(badgeRow("connecticut")).toBeNull();
    expect(badgeRow("not-a-state")).toBeNull();
  });

  it("builds well-formed SVG for every state with escaped text", () => {
    for (const r of rows) {
      const svg = badgeSvg(r);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/<script|on\w+=/i);
      expect(svg).toContain(r.name);
    }
    const tricky = { ...rows[0], name: `A & B <x>` };
    expect(badgeSvg(tricky)).toContain("A &amp; B &lt;x&gt;");
  });

  it("keeps every word of the date and fee (nothing cut off)", () => {
    for (const r of rows) {
      expect(wrapText(r.when, 40).length).toBeLessThanOrEqual(4);
      expect(wrapText(`State fee: ${r.stateFee}`, 52).length).toBeLessThanOrEqual(4);
    }
  });

  it("embed code is a plain link around an image, no script", () => {
    const html = badgeEmbedHtml(badgeRow("pennsylvania")!);
    expect(html).toMatch(/^<a href="[^"]+\/annual-report\/pennsylvania\?utm_source=deadline_badge&utm_medium=referral"/);
    expect(html).toContain('/api/badge/pennsylvania"');
    expect(html).not.toMatch(/<script/i);
  });

  it("wraps long dates without losing words", () => {
    const text = "LLCs: September 30. Business corporations: June 30.";
    const lines = wrapText(text, 20);
    expect(lines.join(" ")).toBe(text);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(26);
  });

  it("serves SVG for a state and 404 for an unknown one", async () => {
    const ok = await badgeGet(new Request("http://x/api/badge/pennsylvania"), { params: Promise.resolve({ state: "pennsylvania" }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("image/svg+xml");
    const missing = await badgeGet(new Request("http://x/api/badge/nowhere"), { params: Promise.resolve({ state: "nowhere" }) });
    expect(missing.status).toBe(404);
  });
});

describe("glossary", () => {
  it("has unique slugs and plain, link-free text", () => {
    const slugs = GLOSSARY.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of GLOSSARY) {
      const text = [t.term, t.definition, t.matters, ...(t.aka ?? [])].join(" ");
      expect(text).not.toMatch(AI_TELLS);
      expect(text).not.toMatch(/https?:\/\/|\$\d/);
      if (t.link) expect(t.link.href.startsWith("/")).toBe(true);
    }
  });
});
