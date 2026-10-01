import { describe, expect, it } from "vitest";
import { findRule } from "@/lib/compliance/registry";
import { contentSha256, DEFAULT_SUBJECTS, renderOutreachEmail, subjectProblem } from "@/lib/outreach/email";
import { campaignGates, decide, recipientGates, senderIsValid, type GateConfig, type RecipientForGate } from "@/lib/outreach/gate";
import { assessSituation } from "@/lib/outreach/segment";

const base = { stateCode: "PA", isForeign: false, formationDate: "2015-03-01", filedYears: null };

describe("PA deadline segmentation (verified rules)", () => {
  it("uses the verified deadlines: corporations June 30, LLCs September 30, other associations December 31", () => {
    expect(findRule("PA", "corporation")?.dueRule).toMatchObject({ month: 6, day: 30 });
    expect(findRule("PA", "llc")?.dueRule).toMatchObject({ month: 9, day: 30 });
    expect(findRule("PA", "lp")?.dueRule).toMatchObject({ month: 12, day: 31 });
  });

  it("LLC on Oct 1, 2026: deadline passed, status unknown (the register has no filing history)", () => {
    const s = assessSituation({ ...base, entityType: "llc", today: "2026-10-01" });
    expect(s).toMatchObject({ kind: "assessed", group: "llc", periodYear: 2026, dueDate: "2026-09-30", filed: null, segment: "unknown_status" });
  });

  it("LP on Nov 15, 2026: approaching (Dec 31, within 60 days)", () => {
    expect(assessSituation({ ...base, entityType: "lp", today: "2026-11-15" })).toMatchObject({ segment: "approaching_deadline", group: "other", dueDate: "2026-12-31" });
  });

  it("LP on Oct 1, 2026: due Dec 31, more than 60 days away: not contacted yet", () => {
    expect(assessSituation({ ...base, entityType: "lp", today: "2026-10-01" })).toMatchObject({ segment: null });
  });

  it("never contacts a business the source shows as filed, and only says 'outstanding' when a source shows it unfiled", () => {
    expect(assessSituation({ ...base, entityType: "llc", today: "2026-10-01", filedYears: [2026] })).toMatchObject({ filed: true, segment: null });
    expect(assessSituation({ ...base, entityType: "llc", today: "2026-10-01", filedYears: [2025] })).toMatchObject({
      filed: false,
      segment: "deadline_passed_outstanding",
    });
  });

  it("a business formed this year owes nothing yet (first report is next year)", () => {
    expect(assessSituation({ ...base, entityType: "llc", formationDate: "2026-02-01", today: "2026-10-01" })).toMatchObject({ segment: null, periodYear: 2027 });
  });

  it("unsupported registration types are never segmented", () => {
    expect(assessSituation({ ...base, entityType: null, today: "2026-10-01" }).kind).toBe("unsupported");
  });
});

const READY: GateConfig = {
  postalAddress: "PO Box 1, Allentown, PA 18101",
  marketingProvider: "approved-provider",
  marketingFrom: "Filewell <hello@mail.getfilewell.com>",
  sendsEnabled: true,
};
const sha = contentSha256({ subject: DEFAULT_SUBJECTS.unknown_status, segment: "unknown_status", entityGroup: "llc" });
const approved = { status: "approved", approvedContentSha256: sha, currentContentSha256: sha, segment: "unknown_status" as const, entityGroup: "llc" as const };
const recipient = (over: Partial<RecipientForGate> = {}): RecipientForGate => ({
  recordSource: "pa_dos_open_data",
  situation: assessSituation({ ...base, entityType: "llc", today: "2026-10-01" }),
  email: { value: "office@acme.example", source: "licensed-provider-x", licenceUse: "marketing_permitted", isBusinessContact: true },
  suppressed: false,
  isCustomer: false,
  ...over,
});

describe("outreach compliance gate", () => {
  it("today's configuration blocks every send: no postal address, no approved provider, no sender, sends off", () => {
    const today: GateConfig = { postalAddress: null, marketingProvider: null, marketingFrom: null, sendsEnabled: false };
    expect(campaignGates(approved, today)).toEqual(["no_postal_address", "no_marketing_provider", "invalid_sender", "sends_disabled"]);
    expect(decide(campaignGates(approved, today), recipientGates(approved, recipient())).send).toBe(false);
  });

  it("Resend is never accepted as the outreach provider (its policy forbids cold outreach)", () => {
    expect(campaignGates(approved, { ...READY, marketingProvider: "resend" })).toContain("no_marketing_provider");
  });

  it("any content change after approval voids it", () => {
    const changed = contentSha256({ subject: "Other subject that may apply", segment: "unknown_status", entityGroup: "llc" });
    expect(campaignGates({ ...approved, currentContentSha256: changed }, READY)).toEqual(["campaign_not_approved"]);
  });

  it("would send only when every campaign and recipient check passes", () => {
    expect(decide(campaignGates(approved, READY), recipientGates(approved, recipient()))).toEqual({ send: true, reasons: [] });
  });

  it("blocks recipients with no email, unknown sources, non-marketing licences, suppression or customer status", () => {
    expect(recipientGates(approved, recipient({ email: null }))).toEqual(["no_email"]);
    expect(recipientGates(approved, recipient({ recordSource: null }))).toContain("record_source_unknown");
    expect(
      recipientGates(approved, recipient({ email: { value: "x@y.example", source: null, licenceUse: "unknown", isBusinessContact: true } })),
    ).toEqual(["contact_source_unknown", "licence_not_marketing"]);
    expect(recipientGates(approved, recipient({ suppressed: true }))).toEqual(["suppressed"]);
    expect(recipientGates(approved, recipient({ isCustomer: true }))).toEqual(["existing_customer"]);
    expect(
      recipientGates(approved, recipient({ email: { value: "not-an-email", source: "s", licenceUse: "marketing_permitted", isBusinessContact: true } })),
    ).toEqual(["email_invalid"]);
  });

  it("blocks businesses outside the segment or entity group", () => {
    const corp = recipient({ situation: assessSituation({ ...base, entityType: "corporation", today: "2026-10-01" }) });
    expect(recipientGates(approved, corp)).toContain("entity_group_mismatch");
  });

  it("sender must be a Filewell domain and must not look governmental", () => {
    expect(senderIsValid("Filewell <hello@getfilewell.com>")).toBe(true);
    expect(senderIsValid("Filewell <hello@mail.getfilewell.com>")).toBe(true);
    expect(senderIsValid("PA Department of State <hello@getfilewell.com>")).toBe(false);
    expect(senderIsValid("Filewell <notice@getfilewell.com>")).toBe(false);
    expect(senderIsValid("Filewell <hello@other.example>")).toBe(false);
    expect(senderIsValid(null)).toBe(false);
  });
});

const sample = {
  subject: DEFAULT_SUBJECTS.unknown_status,
  businessName: "Acme Holdings LLC",
  segment: "unknown_status" as const,
  periodYear: 2026,
  dueDate: "2026-09-30",
  stateFeeCents: 700,
  nonprofitStateFeeCents: 0,
  serviceFeeCents: 4900,
  ctaUrl: "https://www.getfilewell.com/find",
  unsubscribeUrl: "https://www.getfilewell.com/outreach/unsubscribe?t=abc",
  postalAddress: "PO Box 1, Allentown, PA 18101",
  senderName: "Filewell (Amary Coulibaly, sole proprietor)",
};

describe("outreach email", () => {
  it("refuses official-sounding, pressuring or certain-sounding subjects", () => {
    for (const bad of ["Pennsylvania Annual Report Notice", "FINAL WARNING: file now", "Action required: annual report", "Avoid the late fee", "Your report is overdue!", "Your report is due"]) {
      expect(subjectProblem(bad), bad).not.toBeNull();
    }
    for (const good of Object.values(DEFAULT_SUBJECTS)) expect(subjectProblem(good), good).toBeNull();
  });

  const email = renderOutreachEmail(sample);

  it("leads with the private-company disclaimer and says the business can file directly for $7", () => {
    expect(email.text.startsWith("Filewell is a private filing service. It is not the Pennsylvania Department of State")).toBe(true);
    expect(email.text).toContain("file directly with the Department of State at file.dos.pa.gov for the $7.00 state fee");
    expect(email.text).toContain("($0.00 with a not-for-profit purpose)");
    expect(email.text).toContain("$49.00 plus the $7.00 state fee ($56.00 total)");
  });

  it("is truthful about the deadline: no late fee, no threats, only if it hasn't been filed", () => {
    expect(email.text).toContain("Pennsylvania charges no late fee");
    expect(email.text).toContain("If it hasn't been filed yet");
    expect(email.text).not.toMatch(/dissol|penalt|final|urgent|must file/i);
  });

  it("has the advertisement label, sender and postal address, and an unsubscribe link (text and HTML)", () => {
    expect(email.text).toContain("This is an advertisement from Filewell.");
    expect(email.text).toContain("Filewell (Amary Coulibaly, sole proprietor), PO Box 1, Allentown, PA 18101");
    expect(email.text).toContain("unsubscribe: https://www.getfilewell.com/outreach/unsubscribe?t=abc");
    expect(email.html).toContain('href="https://www.getfilewell.com/outreach/unsubscribe?t=abc"');
    expect(email.html).not.toMatch(/<script/i);
  });

  it("escapes business names in HTML", () => {
    expect(renderOutreachEmail({ ...sample, businessName: "<b>Evil</b> LLC" }).html).toContain("&lt;b&gt;Evil&lt;/b&gt; LLC");
  });
});
