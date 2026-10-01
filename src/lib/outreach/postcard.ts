import { formatCents } from "@/lib/domain/money";

/**
 * Copy for the Pennsylvania December 31 postcard (6x4 in, one side copy + one side address).
 * Pure, vendor-agnostic: renders plain text for review and print-ready HTML for a mail
 * vendor's template. Facts come from the verified rule; the card says the report MAY be
 * due (the open dataset has no filing history) and never claims a status.
 *
 * Required elements (tests enforce them):
 *  - prominent private-service / not-a-government-agency / advertisement banner
 *  - "may be due", "Already filed? Please ignore this card."
 *  - direct-filing option with the state fee, and Filewell's fee shown separately with total
 *  - solicitation-not-a-bill notice (39 U.S.C. 3001(d), because a card that shows fees
 *    could be read as an invoice), plus a Georgia-style (O.C.G.A. 10-1-393.16) top banner
 *    as best practice: PA has no specific statute, but its Department of State publicly
 *    names filing services whose mail misleads
 *  - operator identity, return address, and how to stop mail
 */

export const POSTCARD_TEMPLATE_VERSION = "pa_dec31_postcard@2026-10-01";

export const SOLICITATION_DISCLAIMER =
  "This is a solicitation for the order of goods or services, or both, and not a bill, invoice, or statement of account due. You are under no obligation to make any payments on account of this offer unless you accept this offer.";

export interface PostcardInput {
  businessName: string;
  periodYear: number;
  stateFeeCents: number;
  nonprofitStateFeeCents: number | null;
  serviceFeeCents: number;
  landingUrl: string;
  operator: string;
  returnAddress: string | null;
}

export interface PostcardCopy {
  banner: string;
  brandLine: string;
  headline: string;
  forLine: string;
  options: string[];
  ignore: string;
  cta: string;
  finePrint: string[];
  returnAddress: string;
}

export function postcardCopy(i: PostcardInput): PostcardCopy {
  const state = formatCents(i.stateFeeCents);
  const ours = formatCents(i.serviceFeeCents);
  const total = formatCents(i.stateFeeCents + i.serviceFeeCents);
  const nonprofit =
    i.nonprofitStateFeeCents != null && i.nonprofitStateFeeCents !== i.stateFeeCents
      ? ` (${formatCents(i.nonprofitStateFeeCents)} for not-for-profit associations)`
      : "";
  return {
    banner: "THIS IS A SOLICITATION. NOT A BILL OR OFFICIAL GOVERNMENT DOCUMENT. NOT SENT BY THE PENNSYLVANIA DEPARTMENT OF STATE.",
    brandLine: "Filewell · Private filing service · Advertisement",
    headline: `Your ${i.periodYear} Pennsylvania annual report may be due by December 31.`,
    forLine: `For ${i.businessName}`,
    options: [
      `File it yourself at file.dos.pa.gov: ${state} state fee${nonprofit}. You don't need a filing service.`,
      `Or have Filewell file it for you: ${ours} service fee + ${state} state fee = ${total}.`,
    ],
    ignore: "Already filed? Please ignore this card.",
    cta: `Start here: ${i.landingUrl.replace(/^https?:\/\//, "")}`,
    finePrint: [
      `Filewell is a private filing service operated by ${i.operator}. It is not the Pennsylvania Department of State and is not affiliated with, endorsed by or acting for any government agency.`,
      SOLICITATION_DISCLAIMER,
      "Pennsylvania charges no late fee for annual reports. To stop mail from Filewell, email support@getfilewell.com.",
    ],
    returnAddress: i.returnAddress ? `Filewell, ${i.returnAddress}` : "Filewell (return address to be added before printing)",
  };
}

export function postcardText(c: PostcardCopy): string {
  return [c.banner, c.brandLine, "", c.headline, c.forLine, "", ...c.options, "", c.ignore, c.cta, "", ...c.finePrint, "", c.returnAddress].join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Print-ready HTML for a 6.25x4.25 in (with 0.125 in bleed) postcard copy side, using
 * vendor merge fields so one template serves every piece: {{business_name}}, {{landing_url}}.
 * The address side is left to the vendor (their address block and postage area).
 */
export function postcardFrontHtml(c: PostcardCopy): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:6.25in 4.25in;margin:0}
body{margin:0;width:6.25in;height:4.25in;font-family:Arial,Helvetica,sans-serif;color:#17231d}
.safe{position:absolute;inset:0.25in;display:flex;flex-direction:column;gap:0.07in}
.banner{background:#17231d;color:#fff;font-weight:700;font-size:9pt;letter-spacing:.04em;padding:.05in .1in;text-align:center}
.brand{font-weight:700;font-size:13pt;color:#1f5a3e}
h1{font-size:15pt;line-height:1.15;margin:0}
.for{font-size:10pt;font-weight:700}
ul{margin:0;padding-left:.18in;font-size:9.5pt;line-height:1.3}
.ignore{font-size:9pt}
.cta{font-size:11pt;font-weight:700}
.fine{font-size:6.5pt;line-height:1.25;color:#333;margin-top:auto}
</style></head><body><div class="safe">
<div class="banner">${esc(c.banner)}</div>
<div class="brand">${esc(c.brandLine)}</div>
<h1>${esc(c.headline)}</h1>
<div class="for">For {{business_name}}</div>
<ul>${c.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
<div class="ignore">${esc(c.ignore)}</div>
<div class="cta">Start here: {{landing_url}}</div>
<div class="fine">${c.finePrint.map(esc).join("<br>")}<br>${esc(c.returnAddress)}</div>
</div></body></html>`;
}
