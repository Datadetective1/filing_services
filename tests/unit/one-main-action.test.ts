import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { filingOptionsSentence } from "@/lib/reminders/engine";

/**
 * Where Filewell files, "Have us file it" is the one action. Filing direct is still said,
 * as a plain line with no link, button or price that pulls the visitor to the state's site.
 */
describe("one main action where we file", () => {
  it("the disclaimer says filing direct is possible without linking away", () => {
    const html = renderToStaticMarkup(createElement(DisclaimerNote, { stateName: "Florida" }));
    expect(html).toContain("You can also file directly with Florida.");
    expect(html).toContain("Not affiliated with");
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/pay only the state fee/);
  });

  it("the disclaimer falls back to 'your state'", () => {
    expect(renderToStaticMarkup(createElement(DisclaimerNote, {}))).toContain("You can also file directly with your state.");
  });

  it("reminders lead with our filing where we sell it", () => {
    const s = filingOptionsSentence(true, "Filewell");
    expect(s.indexOf("Filewell can prepare")).toBe(0);
    expect(s).not.toMatch(/https?:|\.gov/);
  });
});
