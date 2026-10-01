import { createHash } from "node:crypto";
import { formatCents } from "@/lib/domain/money";
import { formatLongDate } from "@/lib/domain/dates";
import type { ISODate } from "@/lib/domain/types";
import type { CampaignSegment } from "./segment";

/**
 * The one outreach template (pa_annual_report_reminder). Content is fixed and reviewed;
 * only the subject is editable, and subjects that read like a government notice or use
 * pressure are refused. Facts come from the verified Pennsylvania rule only:
 *  - state fee shown on its own line, and that the business can file directly for it
 *  - "may be due" (we don't know whether this business has filed)
 *  - no late fee (Pennsylvania charges none), no dissolution threats
 * Every email carries: a private-company disclaimer at the top, the advertisement label,
 * the sender's postal address and a one-click unsubscribe link.
 */

export const OUTREACH_TEMPLATE_VERSION = "pa_annual_report_reminder@2026-09-30";

export const DEFAULT_SUBJECTS: Record<CampaignSegment, string> = {
  approaching_deadline: "Reminder: your Pennsylvania annual report may be due soon",
  deadline_passed_outstanding: "Reminder: your Pennsylvania annual report may still be open",
  unknown_status: "Reminder: your Pennsylvania annual report may be due",
};

const BANNED = [
  /\bnotice\b/i, /\bfinal\b/i, /\bwarning\b/i, /\burgent\b/i, /\bimmediate(ly)?\b/i, /action required/i, /\bofficial\b/i,
  /\bdepartment\b/i, /\bcommonwealth\b/i, /\bgovernment\b/i, /\bstate of\b/i, /\bpenalt(y|ies)\b/i, /late fee/i,
  /dissol/i, /\bdelinquent\b/i, /\boverdue\b/i, /\bcompliance alert\b/i, /\blast chance\b/i, /!/,
];

/** Null when acceptable, otherwise why the subject is refused. */
export function subjectProblem(subject: string): string | null {
  const s = subject.trim();
  if (s.length < 10 || s.length > 120) return "Use 10 to 120 characters.";
  const hit = BANNED.find((re) => re.test(s));
  if (hit) return "Don't use words that sound official, urgent or threatening (notice, final, urgent, official, department, late fee, penalty, overdue, !).";
  if (!/may/i.test(s)) return 'Say the report "may" be due: we don\'t know whether this business has filed.';
  return null;
}

export function contentSha256(input: { subject: string; segment: CampaignSegment; entityGroup: string }): string {
  return createHash("sha256").update(JSON.stringify([OUTREACH_TEMPLATE_VERSION, input.subject.trim(), input.segment, input.entityGroup])).digest("hex");
}

export interface OutreachEmailInput {
  subject: string;
  businessName: string;
  segment: CampaignSegment;
  periodYear: number;
  dueDate: ISODate;
  stateFeeCents: number;
  /** When the rule charges nonprofits a different state fee (e.g. $0 for not-for-profit LLCs). */
  nonprofitStateFeeCents?: number | null;
  serviceFeeCents: number;
  ctaUrl: string;
  unsubscribeUrl: string;
  postalAddress: string | null;
  senderName: string;
}

const DISCLAIMER =
  "Filewell is a private filing service. It is not the Pennsylvania Department of State and is not affiliated with any government agency.";

export function renderOutreachEmail(i: OutreachEmailInput): { subject: string; text: string; html: string } {
  const due = formatLongDate(i.dueDate);
  const stateFee = formatCents(i.stateFeeCents);
  const total = formatCents(i.stateFeeCents + i.serviceFeeCents);
  const situation =
    i.segment === "approaching_deadline"
      ? `${i.businessName}'s ${i.periodYear} Pennsylvania annual report is due by ${due}. If it hasn't been filed yet, here are your options.`
      : `Pennsylvania's deadline for ${i.businessName}'s ${i.periodYear} annual report was ${due}. Pennsylvania charges no late fee, and the report can still be filed. If it hasn't been filed yet, here are your options.`;
  const paragraphs = [
    DISCLAIMER,
    situation,
    `File it yourself: you can file directly with the Department of State at file.dos.pa.gov for the ${stateFee} state fee${
      i.nonprofitStateFeeCents != null && i.nonprofitStateFeeCents !== i.stateFeeCents ? ` (${formatCents(i.nonprofitStateFeeCents)} with a not-for-profit purpose)` : ""
    }. You don't need a filing service.`,
    `Or have Filewell file it: we prepare and submit it for you for ${formatCents(i.serviceFeeCents)} plus the ${stateFee} state fee (${total} total), and send you the state's confirmation.`,
    `If you've already filed, you can ignore this email.`,
  ];
  const footer = [
    "This is an advertisement from Filewell.",
    `${i.senderName}${i.postalAddress ? `, ${i.postalAddress}` : ""}`,
    `To stop these emails, unsubscribe: ${i.unsubscribeUrl}`,
  ];
  const text = [...paragraphs, `Get started: ${i.ctaUrl}`, "", ...footer].join("\n\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = [
    `<p style="font-size:13px;color:#4b5563;border:1px solid #d1d5db;padding:8px 12px;border-radius:6px">${esc(DISCLAIMER)}</p>`,
    ...paragraphs.slice(1).map((p) => `<p>${esc(p)}</p>`),
    `<p><a href="${esc(i.ctaUrl)}">Get started with Filewell</a></p>`,
    `<hr><p style="font-size:12px;color:#6b7280">${footer.slice(0, 2).map(esc).join("<br>")}<br><a href="${esc(i.unsubscribeUrl)}">Unsubscribe</a></p>`,
  ].join("\n");
  return { subject: i.subject.trim(), text, html };
}
