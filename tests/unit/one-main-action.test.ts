import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { filingOptionsSentence } from "@/lib/reminders/engine";

/**
 * Where Filewell files, "Have us file it" is the one action. Pages and reminders never
 * link to the state's own filing site or tell the visitor to file there instead.
 */
describe("one main action where we file", () => {
  it("the disclaimer says we are private without pointing to the state's site", () => {
    const html = renderToStaticMarkup(createElement(DisclaimerNote, {}));
    expect(html).toContain("Not affiliated with");
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/file directly|pay only the state fee/i);
  });

  it("reminders lead with our filing where we sell it", () => {
    const s = filingOptionsSentence(true, "Filewell");
    expect(s.indexOf("Filewell can prepare")).toBe(0);
    expect(s).not.toMatch(/https?:|\.gov/);
  });

  it("reminders for states we don't file in never point to the state's site", () => {
    const s = filingOptionsSentence(false, "Filewell");
    expect(s).not.toMatch(/https?:|\.gov|directly|yourself/i);
  });
});
