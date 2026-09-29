import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { escapeHtml, interpolate, renderEmail, singleLine } from "@/lib/email/render";

const MALICIOUS = `<script>alert('x')</script> & "Co"`;

function render(over: Partial<Parameters<typeof renderEmail>[0]> = {}) {
  return renderEmail({
    subject: "Your {{state_name}} report for {{company_name}}",
    body: "Hello,\n\n{{company_name}}'s report is due {{due_phrase}}.\nFrom {{brand}}.",
    ctaLabel: "Review your filing",
    ctaUrl: "https://app.filewell.example/r/abc?to=/dashboard",
    vars: { state_name: "Pennsylvania", company_name: "Acme LLC", due_phrase: "in 3 days" },
    ...over,
  });
}

describe("interpolate", () => {
  it("substitutes known variables and blanks unknown or empty ones", () => {
    expect(interpolate("Hi {{name}}, {{ missing }}!", { name: "Jane" })).toBe("Hi Jane, !");
    expect(interpolate("{{a}}-{{b}}-{{c}}", { a: 1, b: null, c: undefined })).toBe("1--");
    expect(interpolate("{{ spaced }}", { spaced: "ok" })).toBe("ok");
  });

  it("does not re-expand placeholders that appear inside values", () => {
    expect(interpolate("{{name}}", { name: "{{secret}}", secret: "leak" })).toBe("{{secret}}");
  });
});

describe("renderEmail", () => {
  it("interpolates subject, text and HTML, with the brand available by default", () => {
    const r = render();
    expect(r.subject).toBe("Your Pennsylvania report for Acme LLC");
    expect(r.text).toContain("Acme LLC's report is due in 3 days.");
    expect(r.text).toContain(`From ${site.name}.`);
    expect(r.text).toContain("Review your filing: https://app.filewell.example/r/abc?to=/dashboard");
    expect(r.html).toContain("Acme LLC&#39;s report is due in 3 days.<br>From Filewell.");
    expect(r.html).toContain('href="https://app.filewell.example/r/abc?to=/dashboard"');
  });

  it("escapes a malicious business name in the HTML part", () => {
    const r = render({ vars: { state_name: "Pennsylvania", company_name: MALICIOUS, due_phrase: "today" } });
    expect(r.html).not.toContain("<script>");
    expect(r.html).not.toContain(`"Co"`);
    expect(r.html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;Co&quot;");
    // Plain text is not HTML, so it carries the value verbatim.
    expect(r.text).toContain(MALICIOUS);
  });

  it("escapes CTA label and URL attributes", () => {
    const r = render({ ctaLabel: "<b>Go</b>", ctaUrl: `https://x.example/?a="><img src=x onerror=alert(1)>` });
    expect(r.html).not.toContain("<img");
    expect(r.html).not.toContain("<b>Go</b>");
    expect(r.html).toContain('href="https://x.example/?a=&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
  });

  it("strips newlines from the subject so values cannot inject headers", () => {
    const r = render({
      vars: { state_name: "Pennsylvania", company_name: "Acme\r\nBcc: attacker@evil.example\n", due_phrase: "today" },
    });
    expect(r.subject).not.toMatch(/[\r\n]/);
    expect(r.subject).toBe("Your Pennsylvania report for Acme Bcc: attacker@evil.example");
    expect(singleLine("a\r\n\r\nb\nc")).toBe("a b c");
    expect(singleLine("x".repeat(500))).toHaveLength(200);
  });

  it("includes the unsubscribe link only when provided", () => {
    const without = render();
    expect(without.text).not.toContain("Stop deadline reminders");
    expect(without.html).not.toContain("Stop deadline reminders");

    const url = "https://app.filewell.example/unsubscribe?t=abc.def";
    const withLink = render({ unsubscribeUrl: url });
    expect(withLink.text).toContain(`Stop deadline reminders: ${url}`);
    expect(withLink.html).toContain(`<a href="${url}"`);
    expect(withLink.html).toContain(">Stop deadline reminders</a>");
  });

  it("omits the CTA when there is no label or URL", () => {
    const r = render({ ctaLabel: null, ctaUrl: null });
    expect(r.html).not.toContain("<a href");
    expect(r.text).not.toContain("Review your filing");
  });

  it("always carries the private-service disclaimer and escapes the footer note", () => {
    const r = render({ footerNote: "<i>note</i>" });
    expect(r.text).toContain(site.disclaimer);
    expect(r.html).toContain(escapeHtml(site.disclaimer));
    expect(r.html).toContain("&lt;i&gt;note&lt;/i&gt;");
    expect(r.html).not.toContain("<i>note</i>");
  });
});

describe("escapeHtml", () => {
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
