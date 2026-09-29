import { afterEach, describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import { renderEmail } from "@/lib/email/render";
import { DEFAULT_TEMPLATES, getDefaultTemplate } from "@/lib/email/templates";

const FILING_VARS = {
  company_name: "Acme LLC",
  state_name: "Pennsylvania",
  filing_title: "Annual Report",
  due_date: "September 30, 2026",
  due_phrase: "today",
  status_label: "Ready for review",
  confirmation_number: "PA-12345",
};

function renderTemplate(key: string, vars: Record<string, string>) {
  const t = getDefaultTemplate(key);
  if (!t) throw new Error(`missing template ${key}`);
  return renderEmail({ subject: t.subject, body: t.body, ctaLabel: t.ctaLabel, ctaUrl: "https://www.getfilewell.com/r/x", vars });
}

describe("money templates", () => {
  it("order_confirmed lists the state fee and our service fee as separate lines, plus the total", () => {
    const r = renderTemplate("order_confirmed", { ...FILING_VARS, government_fee: "$7.00", service_fee: "$49.00", amount: "$56.00" });
    expect(r.text).toContain("Government filing fee (paid to Pennsylvania, passed through at cost): $7.00");
    expect(r.text).toContain("Our service fee: $49.00");
    expect(r.text).toContain("Total paid: $56.00");
    expect(r.text).not.toMatch(/service fee[^\n]*government/i);
    expect(r.html).toContain("Our service fee: $49.00<br>Total paid: $56.00");
  });

  it("refund_issued splits the refunded amount the same way", () => {
    const r = renderTemplate("refund_issued", { ...FILING_VARS, government_fee: "$0.00", service_fee: "$49.00", amount: "$49.00" });
    expect(r.subject).toBe("Refund issued: $49.00");
    expect(r.text).toContain("Government filing fee refunded: $0.00");
    expect(r.text).toContain("Service fee refunded: $49.00");
    expect(r.text).toContain("Total refunded: $49.00");
  });
});

describe("accuracy of customer templates", () => {
  it("filing_accepted says the confirmation is in the dashboard (it is only sent once a receipt is on file)", () => {
    const t = getDefaultTemplate("filing_accepted")!;
    expect(t.ctaLabel).toBe("View filing");
    const r = renderTemplate("filing_accepted", FILING_VARS);
    expect(r.text).toContain("Confirmation number: PA-12345.");
    expect(r.text).toContain("The state's confirmation is saved in your dashboard, where you can view and download it.");
    // The document_ready email has already gone out by then: never promise another email.
    expect(t.body).not.toMatch(/email you|we'll (let you know|send)|when (each|it) is ready/i);
  });

  it("document_ready names the document and business using the camelCase vars its sender passes", () => {
    const t = getDefaultTemplate("document_ready")!;
    expect(t.category).toBe("transactional");
    expect(t.ctaLabel).toBe("View document");
    const r = renderTemplate("document_ready", {
      ...FILING_VARS,
      businessName: "Acme LLC",
      filingName: "Annual Report",
      documentLabel: "State acknowledgement letter",
    });
    expect(r.subject).toBe("Your Annual Report document is ready");
    expect(r.text).toContain("We added a document to Acme LLC's Annual Report: State acknowledgement letter.");
  });

  it("no template states a late fee, penalty or fear language", () => {
    for (const t of DEFAULT_TEMPLATES) {
      const all = `${t.subject}\n${t.body}\n${t.ctaLabel ?? ""}`;
      expect(all, t.key).not.toMatch(/late fee|penalt|\bfine[sd]?\b|final (notice|warning)|urgent|official notice/i);
    }
  });

  it("every template key is unique", () => {
    const keys = DEFAULT_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("staff templates", () => {
  it("staff_new_paid_order shows both fees, the total and the payment mode", () => {
    const t = getDefaultTemplate("staff_new_paid_order")!;
    expect(t.category).toBe("transactional");
    const r = renderTemplate("staff_new_paid_order", {
      ...FILING_VARS,
      government_fee: "$7.00",
      service_fee: "$49.00",
      amount: "$56.00",
      payment_mode: "live",
    });
    expect(r.subject).toBe("New paid order: Acme LLC (Pennsylvania Annual Report)");
    expect(r.text).toContain("Government filing fee: $7.00\nService fee: $49.00\nTotal paid: $56.00\nPayment mode: live");
    expect(r.text).toContain("Open filing: https://www.getfilewell.com/r/x");
  });

  it("staff_customer_message points staff at the filing without quoting the customer's message", () => {
    const r = renderTemplate("staff_customer_message", { ...FILING_VARS, message: "my SSN is 123" });
    expect(r.subject).toBe("Customer message: Acme LLC (Pennsylvania Annual Report)");
    expect(r.text).toContain("Filing status: Ready for review.");
    expect(r.text).toContain("at most one of these alerts per filing each hour");
    expect(r.text).not.toContain("123");
  });
});

describe("email footer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("carries the brand, the disclaimer and a support line; no address is invented when none is configured", () => {
    const r = renderTemplate("filing_submitted", FILING_VARS);
    expect(r.text).toContain(`Questions? Reply to this email or write to ${site.supportEmail}.`);
    expect(r.text).toContain(site.disclaimer);
    if (!site.postalAddress && !site.legalEntityConfigured) {
      expect(r.text).toMatch(new RegExp(`----\\n\\n${site.name}\\n\\n`));
    }
  });

  it("adds the legal entity and postal address when configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEGAL_ENTITY", "Filewell Services LLC");
    vi.stubEnv("NEXT_PUBLIC_POSTAL_ADDRESS", "100 Market St, Suite 5, Philadelphia, PA 19106");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_EMAIL", "help@getfilewell.com");
    vi.resetModules();
    const fresh = await import("@/lib/email/render");
    const r = fresh.renderEmail({ subject: "s", body: "b", ctaLabel: null, ctaUrl: null, vars: {} });
    expect(r.text).toContain("Filewell · Filewell Services LLC · 100 Market St, Suite 5, Philadelphia, PA 19106");
    expect(r.text).toContain("Questions? Reply to this email or write to help@getfilewell.com.");
    expect(r.html).toContain("Filewell · Filewell Services LLC · 100 Market St, Suite 5, Philadelphia, PA 19106");
  });
});
