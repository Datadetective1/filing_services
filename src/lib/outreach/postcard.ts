import { formatCents } from "@/lib/domain/money";

/**
 * The Pennsylvania December 31 postcard (4x6 in; artwork 6.25x4.25 in including 0.125 in
 * bleed). Pure and vendor-agnostic: plain-text copy for review, and print HTML for each side.
 *
 * Copy rules (tests enforce them):
 *  - the most prominent element on the front: a private solicitation, not a bill, not a
 *    government document, not sent by the Pennsylvania Department of State
 *  - "may be due" (the open dataset has no filing history; never a status claim)
 *  - the business can file directly with Pennsylvania for the state fee instead of using us
 *  - Filewell's fee shown separately from the state fee, with the total
 *  - operator identity, return address, how to stop mail
 *
 * The solicitation statement is modeled on the language 39 U.S.C. § 3001(d) describes for
 * mail that could reasonably be read as a bill or invoice, and is included as a precaution.
 * Whether that provision applies to this card, and whether any wording here satisfies any
 * rule, are questions for counsel; nothing in the code or docs should claim otherwise.
 */

export const POSTCARD_TEMPLATE_VERSION = "pa_dec31_postcard@2026-10-01b";

export const SOLICITATION_STATEMENT =
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
  bannerSub: string;
  brandLine: string;
  headline: string;
  forLine: string;
  directOption: string;
  filewellOption: string;
  options: string[];
  ignore: string;
  cta: string;
  shortUrl: string;
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
  const directOption = `You can file directly with the Pennsylvania Department of State at file.dos.pa.gov for the ${state} state fee${nonprofit} instead of using Filewell.`;
  const filewellOption = `Or have Filewell prepare and file it: ${ours} service fee + ${state} state fee = ${total}.`;
  const shortUrl = i.landingUrl.replace(/^https?:\/\//, "");
  return {
    banner: "THIS IS A SOLICITATION. NOT A BILL. NOT A GOVERNMENT DOCUMENT.",
    bannerSub: "Not sent by the Pennsylvania Department of State. Filewell is a private filing service. Advertisement.",
    brandLine: "Filewell · Private filing service · Advertisement",
    headline: `Your ${i.periodYear} Pennsylvania annual report may be due by December 31.`,
    forLine: `For ${i.businessName}`,
    directOption,
    filewellOption,
    options: [directOption, filewellOption],
    ignore: "Already filed? Please ignore this card.",
    cta: `Start here: ${shortUrl}`,
    shortUrl,
    finePrint: [
      `Filewell is a private filing service operated by ${i.operator}. It is not the Pennsylvania Department of State and is not affiliated with, endorsed by or acting for any government agency.`,
      SOLICITATION_STATEMENT,
      "Pennsylvania charges no late fee for annual reports. To stop mail from Filewell, email support@getfilewell.com.",
    ],
    returnAddress: i.returnAddress ? `Filewell, ${i.returnAddress}` : "Filewell (return address to be added before printing)",
  };
}

export function postcardText(c: PostcardCopy): string {
  return [c.banner, c.bannerSub, c.brandLine, "", c.headline, c.forLine, "", ...c.options, "", c.ignore, c.cta, "", ...c.finePrint, "", c.returnAddress].join("\n");
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BASE_CSS = `@page{size:6.25in 4.25in;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{width:6.25in;height:4.25in;position:relative;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#17231d;background:#fff}`;

/** Front: the disclosure banner dominates, then the "may be due" headline and both options. */
export function postcardFrontHtml(c: PostcardCopy): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
.band{position:absolute;left:0;right:0;top:0;height:1.18in;background:#17231d;color:#fff;padding:0.3in 0.4in 0 0.4in}
.band b{display:block;font-size:15.5pt;line-height:1.15;letter-spacing:.01em}
.band span{display:block;margin-top:.05in;font-size:8.6pt;line-height:1.25;color:#e8efe9}
.main{position:absolute;left:0.4in;right:0.4in;top:1.32in;bottom:0.32in;display:flex;flex-direction:column}
h1{margin:0;font-size:17pt;line-height:1.13}
.for{margin-top:.05in;font-size:9.5pt;font-weight:700}
.opts{margin-top:.12in;display:grid;grid-template-columns:1fr 1fr;gap:.12in}
.opt{border:1.5pt solid #17231d;border-radius:.08in;padding:.08in .1in;font-size:8.6pt;line-height:1.3}
.opt strong{display:block;font-size:9.5pt;margin-bottom:.02in}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;font-size:8pt}
.brand{font-weight:700;font-size:12pt;color:#1f5a3e}
</style></head><body>
<div class="band"><b>${esc(c.banner)}</b><span>${esc(c.bannerSub)}</span></div>
<div class="main">
<h1>${esc(c.headline)}</h1>
<div class="for">${esc(c.forLine)}</div>
<div class="opts">
<div class="opt"><strong>File it yourself</strong>${esc(c.directOption)}</div>
<div class="opt"><strong>Or let Filewell file it</strong>${esc(c.filewellOption.replace(/^Or have Filewell prepare and file it: /, "We prepare and file it: "))}</div>
</div>
<div class="foot"><span class="brand">Filewell</span><span>${esc(c.ignore)}</span></div>
</div>
</body></html>`;
}

/**
 * Back: copy and QR on the left 2.6 in; everything right of that is left blank for the
 * mail vendor's address block, postage and barcode (Lob's ink-free zone sits bottom-right).
 */
export function postcardBackHtml(c: PostcardCopy, qrSrc: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
.col{position:absolute;left:0.375in;top:0.375in;bottom:0.375in;width:2.6in;display:flex;flex-direction:column;gap:.07in}
.disc{background:#17231d;color:#fff;font-weight:700;font-size:8pt;line-height:1.25;padding:.06in .08in}
.lead{font-size:9pt;line-height:1.3;font-weight:700}
.qr{display:flex;gap:.1in;align-items:center}
.qr img{width:0.9in;height:0.9in;display:block}
.qr div{font-size:8.2pt;line-height:1.3}
.qr b{display:block;font-size:8.6pt;word-break:break-all}
.fine{font-size:5.6pt;line-height:1.28;color:#222;margin-top:auto}
.fine p{margin:0 0 .03in 0}
</style></head><body>
<div class="col">
<div class="disc">${esc(c.banner)} Not sent by the Pennsylvania Department of State.</div>
<div class="lead">${esc(c.directOption)}</div>
<div class="qr"><img src="${esc(qrSrc)}" alt=""><div>Scan, or visit<b>${esc(c.shortUrl)}</b>${esc(c.ignore)}</div></div>
<div class="fine">${c.finePrint.map((f) => `<p>${esc(f)}</p>`).join("")}<p>${esc(c.returnAddress)}</p></div>
</div>
</body></html>`;
}
