import { absoluteUrl, site } from "@/config/site";
import { dueDateRows, type DueDateRow } from "./due-dates";

/**
 * The free annual report deadline badge that accountants, bookkeepers and business blogs can
 * put on their own sites. The picture is an SVG built only from the verified due date rows (the
 * same facts as /annual-report/due-dates), so it never shows a date we haven't checked. The
 * link around it points at the state's annual report page, which is how the badge earns a
 * visit and a link back.
 */

export const BADGE_WIDTH = 360;

export function badgeRows(): DueDateRow[] {
  return dueDateRows();
}

export function badgeRow(slug: string): DueDateRow | null {
  return dueDateRows().find((r) => r.slug === slug) ?? null;
}

export function badgeImagePath(slug: string): string {
  return `/api/badge/${slug}`;
}

export function badgeLinkUrl(slug: string): string {
  return absoluteUrl(`/annual-report/${slug}?utm_source=deadline_badge&utm_medium=referral`);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Wraps text into lines of at most `max` characters, breaking on spaces. */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const sentence of text.split(/(?<=\.)\s+/)) {
    let line = "";
    for (const word of sentence.split(/\s+/).filter(Boolean)) {
      if (line && `${line} ${word}`.length > max) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** The embed code a site owner pastes: a plain link around an image, no script. */
export function badgeEmbedHtml(row: DueDateRow): string {
  const alt = `${row.name} ${row.reportName.toLowerCase()} due date`;
  return `<a href="${badgeLinkUrl(row.slug)}" target="_blank" rel="noopener"><img src="${absoluteUrl(badgeImagePath(row.slug))}" width="${BADGE_WIDTH}" alt="${escapeXml(alt)}" loading="lazy"></a>`;
}

export function badgeSvg(row: DueDateRow): string {
  const W = BADGE_WIDTH;
  const whenLines = wrapText(row.when, 40).slice(0, 4);
  const top = 30;
  const lineH = 20;
  const whenTop = 84;
  const feeLines = wrapText(`State fee: ${row.stateFee}`, 52).slice(0, 4);
  const feeY = whenTop + whenLines.length * lineH + 8;
  const footY = feeY + (feeLines.length - 1) * 17;
  const H = footY + 46;
  const title = `${row.name} ${row.reportName.toLowerCase()}`;
  const when = whenLines
    .map((l, i) => `<text x="20" y="${whenTop + i * lineH}" font-size="15" font-weight="600" fill="#F6F3EA">${escapeXml(l)}</text>`)
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(`${title} due: ${row.when}`)}">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173F31"/><stop offset="1" stop-color="#0E2A20"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" rx="14" fill="url(#g)"/>`,
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="13.5" fill="none" stroke="#F2B23A" stroke-opacity="0.35"/>`,
    `<circle cx="${W - 34}" cy="${top + 4}" r="14" fill="#F2B23A" fill-opacity="0.16"/>`,
    `<rect x="${W - 42}" y="${top - 4}" width="16" height="15" rx="3" fill="none" stroke="#F2B23A" stroke-width="1.6"/>`,
    `<line x1="${W - 42}" y1="${top + 1}" x2="${W - 26}" y2="${top + 1}" stroke="#F2B23A" stroke-width="1.6"/>`,
    `<text x="20" y="${top}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="11" letter-spacing="1.4" fill="#F2B23A">DUE DATE</text>`,
    `<g font-family="Inter, Helvetica, Arial, sans-serif">`,
    `<text x="20" y="${top + 26}" font-size="17" font-weight="700" fill="#FFFFFF">${escapeXml(title)}</text>`,
    when,
    feeLines.map((l, i) => `<text x="20" y="${feeY + i * 17}" font-size="13" fill="#C9D6CF">${escapeXml(l)}</text>`).join(""),
    `<line x1="20" y1="${footY + 14}" x2="${W - 20}" y2="${footY + 14}" stroke="#FFFFFF" stroke-opacity="0.12"/>`,
    `<text x="20" y="${footY + 32}" font-size="12" fill="#C9D6CF">Free reminders and filing at <tspan fill="#F2B23A" font-weight="600">${escapeXml(site.domain)}</tspan></text>`,
    `</g></svg>`,
  ].join("");
}
