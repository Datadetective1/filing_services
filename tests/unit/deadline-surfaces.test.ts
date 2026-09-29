import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequirementCard } from "@/components/compliance/requirement-card";
import { FilingTicket } from "@/components/funnel/filing-ticket";
import { findRule } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { currentFilingPeriod } from "@/lib/domain/deadlines";
import { filingWindowText } from "@/lib/seo/content";

/**
 * Deadline wording on the surfaces a customer sees around September 30: the public
 * requirement card, the order funnel's filing ticket and the state/entity "Filing
 * window" fact, plus the caching of every public page that shows a live day count.
 */

function paRule(entityType: "llc" | "lp"): ComplianceRuleDef {
  const rule = findRule("PA", entityType);
  if (!rule) throw new Error(`missing PA rule for ${entityType}`);
  return rule;
}

const llc = paRule("llc");
const NO_LATE_FEE_NOTE = "Pennsylvania charges no state late fee, and the report can still be filed.";
/** Never in customer-facing deadline copy: negative counts or overdue wording. */
const ALARM = /past due|overdue|days late|-\d+ day/i;

/** Visible text only (tags stripped), so attribute values don't count. */
function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function card(today: string) {
  const period = currentFilingPeriod(llc, { today });
  const html = renderToStaticMarkup(createElement(RequirementCard, { rule: llc, period }));
  return { period, html, t: text(html) };
}

describe("RequirementCard around the Pennsylvania LLC deadline", () => {
  it("Sept 29: 'Due tomorrow' with a singular accessible label", () => {
    const { html, t } = card("2026-09-29");
    expect(t).toContain("Due tomorrow");
    expect(html).toContain('aria-label="1 day until the September 30, 2026 deadline"');
    expect(html).not.toContain("1 days");
    expect(t).not.toContain(NO_LATE_FEE_NOTE);
  });

  it("Sept 30: 'Due today', never '0 days'", () => {
    const { html, t } = card("2026-09-30");
    expect(t).toContain("Due today");
    expect(html).toContain('aria-label="Due today, September 30, 2026"');
    expect(html).not.toMatch(/\b0 days\b/);
    expect(t).not.toContain(NO_LATE_FEE_NOTE);
  });

  it("Oct 1: the deadline passed, with the verified no-late-fee sentence and no negative count", () => {
    const { period, html, t } = card("2026-10-01");
    expect(period).toMatchObject({ periodYear: 2026, daysRemaining: -1, phase: "overdue" });
    expect(t).toContain("Deadline passed September 30");
    expect(t).toContain(NO_LATE_FEE_NOTE);
    expect(html).toContain('aria-label="The September 30, 2026 deadline has passed"');
    expect(html).not.toMatch(ALARM);
    // The optional filing offer stays on the card after the deadline.
    expect(t).toContain("We can file this for you");
  });

  it("the no-late-fee sentence needs verified proof: an unverified rule gets only the date", () => {
    const rule = { ...llc, verificationStatus: "unverified" as const };
    const period = currentFilingPeriod(rule, { today: "2026-10-01" });
    const t = text(renderToStaticMarkup(createElement(RequirementCard, { rule, period })));
    expect(t).toContain("Deadline passed September 30");
    expect(t).not.toContain(NO_LATE_FEE_NOTE);
  });
});

describe("FilingTicket (order funnel)", () => {
  const ticket = (daysRemaining: number) =>
    text(
      renderToStaticMarkup(
        createElement(FilingTicket, {
          businessName: "Keystone Test LLC",
          stateName: "Pennsylvania",
          filingName: "Annual Report",
          periodYear: 2026,
          dueDate: "2026-09-30",
          daysRemaining,
        }),
      ),
    );

  it("counts down, says 'Due today' on the date, then 'Deadline passed' with no count", () => {
    expect(ticket(12)).toContain("12 days left");
    expect(ticket(1)).toContain("Due tomorrow");
    expect(ticket(0)).toContain("Due today");
    for (const days of [-1, -45]) {
      const t = ticket(days);
      expect(t).toContain("Deadline passed September 30");
      expect(t).not.toMatch(ALARM);
    }
  });
});

describe("filingWindowText", () => {
  it("says when filing opens without an end date that would contradict 'can still be filed'", () => {
    expect(filingWindowText(llc)).toBe("Opens January 1 of the report year");
    expect(filingWindowText(llc)).not.toMatch(/to September 30/);
  });

  it("is null for rules without a fixed annual deadline", () => {
    expect(filingWindowText({ ...llc, dueRule: { kind: "anniversary_month_end" } } as ComplianceRuleDef)).toBeNull();
  });
});

describe("public pages that show a live day count render per request", () => {
  const root = path.resolve(__dirname, "../../src/app/(marketing)");
  const pages = [
    "page.tsx",
    "annual-report/[state]/page.tsx",
    "annual-report/[state]/[entity]/page.tsx",
    "states/[state]/page.tsx",
  ];

  it.each(pages)("%s exports revalidate = 0", (file) => {
    const source = readFileSync(path.join(root, file), "utf8");
    expect(source).toMatch(/^export const revalidate = 0;$/m);
  });
});
