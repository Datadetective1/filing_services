/**
 * A one-event iCalendar file (RFC 5545) for a filing due date: an all-day event with two
 * reminders, built only from values the caller has already validated.
 */

export interface DeadlineEventInput {
  /** YYYY-MM-DD */
  dueDate: string;
  summary: string;
  description: string;
  url: string;
  /** Stable per business and date, so re-adding updates instead of duplicating. */
  uid: string;
  /** For DTSTAMP. */
  now?: Date;
}

/** Escape TEXT values: backslash, semicolon, comma and newlines. */
export function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold a content line at 75 octets, continuing with CRLF + space. */
export function icsFold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

function compactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function deadlineIcs(input: DeadlineEventInput): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Filewell//Filing deadline//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${stamp(input.now ?? new Date())}`,
    `DTSTART;VALUE=DATE:${compactDate(input.dueDate)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDay(input.dueDate))}`,
    `SUMMARY:${icsEscape(input.summary)}`,
    `DESCRIPTION:${icsEscape(input.description)}`,
    `URL:${input.url}`,
    "TRANSP:TRANSPARENT",
    ...[30, 7].flatMap((days) => [
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(input.summary)}`,
      `TRIGGER:-P${days}D`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}
