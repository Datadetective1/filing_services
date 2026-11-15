import { describe, expect, it } from "vitest";
import { calendarLink, cleanBusinessName, parseDeadlineQuery } from "@/lib/calendar/deadline";
import { deadlineIcs, icsEscape, icsFold } from "@/lib/calendar/ics";
import { businessSearchFaq, businessSearchPageStates, businessSearchPath, businessSearchStates } from "@/lib/seo/business-search";

describe("business search pages", () => {
  it("has a page for every searchable state, and Pennsylvania keeps its guide", () => {
    const codes = businessSearchStates().map((s) => s.code);
    expect(codes).toEqual(expect.arrayContaining(["PA", "CO", "CT", "NY", "OR", "TX"]));
    expect(businessSearchPath("PA")).toBe("/pennsylvania/business-search");
    expect(businessSearchPath("CO")).toBe("/business-search/colorado");
    expect(businessSearchPath("NY")).toBe("/business-search/new-york");
    expect(businessSearchPath("FL")).toBeNull();
    expect(businessSearchPageStates().some((s) => s.code === "PA")).toBe(false);
  });

  it("never claims standing or official status", () => {
    for (const s of businessSearchPageStates()) {
      const text = businessSearchFaq(s).map((f) => `${f.q} ${f.a}`).join(" ");
      expect(text).toContain("private service");
      expect(text).not.toMatch(/--|—/);
      expect(text).not.toMatch(/https?:\/\//);
    }
  });
});

describe("add to calendar", () => {
  const today = new Date("2026-11-15T12:00:00Z");

  it("builds a link the route accepts", () => {
    const href = calendarLink({ stateCode: "CO", entityType: "llc", isForeign: false, dueDate: "2027-04-30", businessName: "Example Hills, LLC" });
    const q = parseDeadlineQuery(new URL(href, "https://x.test").searchParams, today);
    expect(q).toMatchObject({ stateCode: "CO", stateName: "Colorado", dueDate: "2027-04-30", businessName: "Example Hills, LLC" });
  });

  it("refuses unknown states, bad dates and far-off dates", () => {
    const p = (s: string) => parseDeadlineQuery(new URLSearchParams(s), today);
    expect(p("state=ZZ&entity=llc&date=2027-04-30")).toBeNull();
    expect(p("state=CO&entity=bogus&date=2027-04-30")).toBeNull();
    expect(p("state=CO&entity=llc&date=2027-02-30")).toBeNull();
    expect(p("state=CO&entity=llc&date=2031-01-01")).toBeNull();
  });

  it("strips links and markup from the business name", () => {
    expect(cleanBusinessName("Acme <script> https://evil.test LLC")).toBe("Acme script httpsevil.test LLC");
    expect(cleanBusinessName("x".repeat(200))).toHaveLength(80);
  });

  it("writes a valid all-day event with two reminders", () => {
    const ics = deadlineIcs({
      dueDate: "2027-04-30",
      summary: "Example Hills, LLC: Colorado periodic report may be due",
      description: "Check what's due: https://www.getfilewell.com/find?state=CO",
      url: "https://www.getfilewell.com/find?state=CO",
      uid: "abc@getfilewell.com",
      now: new Date("2026-11-15T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270430\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270501\r\n");
    expect(ics).toContain("SUMMARY:Example Hills\\, LLC: Colorado periodic report may be due");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("TRIGGER:-P30D");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("escapes and folds per RFC 5545", () => {
    expect(icsEscape("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
    const folded = icsFold("X".repeat(160));
    expect(folded.split("\r\n ").join("")).toBe("X".repeat(160));
  });
});

describe("comparison pages", async () => {
  const { COMPETITORS, comparePath, competitorBySlugPath } = await import("@/lib/seo/compare");
  it("has one page per competitor and resolves its slug", () => {
    expect(COMPETITORS.map((c) => comparePath(c))).toEqual([
      "/compare/filewell-vs-legalzoom",
      "/compare/filewell-vs-zenbusiness",
      "/compare/filewell-vs-northwest",
      "/compare/filewell-vs-bizee",
      "/compare/filewell-vs-registered-agents-inc",
      "/compare/filewell-vs-harbor-compliance",
    ]);
    expect(competitorBySlugPath("filewell-vs-zenbusiness")?.name).toBe("ZenBusiness");
    expect(competitorBySlugPath("zenbusiness")).toBeNull();
  });
  it("keeps the copy plain: no links, no dashes, says where each competitor does more", () => {
    for (const c of COMPETITORS) {
      const text = JSON.stringify(c);
      expect(text).not.toMatch(/https?:\/\/|--|—/);
      expect(c.theyInclude.length).toBeGreaterThan(0);
      expect(c.sources.length).toBeGreaterThan(0);
    }
  });
});
