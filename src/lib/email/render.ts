import { site } from "@/config/site";

/**
 * Template rendering with strict escaping. Variables are substituted into text,
 * then the whole text is HTML-escaped for the HTML part, so user-controlled
 * values (business names, operator messages) can never inject markup.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function interpolate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Strip CR/LF so a value can never add headers when used in a subject line. */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

export interface RenderInput {
  subject: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  vars: Record<string, string | number | null | undefined>;
  footerNote?: string | null;
  unsubscribeUrl?: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function renderEmail(input: RenderInput): RenderedEmail {
  const vars = { brand: site.name, ...input.vars };
  const subject = singleLine(interpolate(input.subject, vars));
  const body = interpolate(input.body, vars);

  const footerLines = [
    `${site.name} — ${site.disclaimer}`,
    input.footerNote ?? null,
    input.unsubscribeUrl ? `Stop deadline reminders: ${input.unsubscribeUrl}` : null,
  ].filter(Boolean) as string[];

  const text = [
    body,
    input.ctaLabel && input.ctaUrl ? `${input.ctaLabel}: ${input.ctaUrl}` : null,
    "—",
    ...footerLines,
  ]
    .filter(Boolean)
    .join("\n\n");

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.55">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";

  const footer = footerLines
    .map((l) =>
      l.startsWith("Stop deadline reminders:") && input.unsubscribeUrl
        ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6b7280">Stop deadline reminders</a>`
        : escapeHtml(l),
    )
    .join("<br>");

  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-weight:700;font-size:16px;margin-bottom:24px">${escapeHtml(site.name)}</div>
<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px 24px;font-size:15px">${paragraphs}${cta}</div>
<div style="font-size:12px;color:#6b7280;line-height:1.5;margin-top:20px">${footer}</div>
</div></body></html>`;

  return { subject, text, html };
}
