import { addDays, formatShortDate, isISODate, todayInTimeZone } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";

/**
 * Formatting and parsing helpers for the operations console. Pure (no server-only
 * imports) so client components can use them too. "Today" in the console is always
 * the operator's business day in America/New_York.
 */

export const OPS_TIME_ZONE = "America/New_York";

export function opsToday(now: Date = new Date()): string {
  return todayInTimeZone(OPS_TIME_ZONE, now);
}

/** Offset (wall clock minus UTC) of a time zone at an instant, in milliseconds. */
function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((wall - at.getTime()) / 60_000) * 60_000;
}

/** The UTC instant of 00:00 on a calendar date in a time zone (DST-safe). */
export function zonedStartOfDay(isoDate: string, timeZone: string = OPS_TIME_ZONE): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const first = zoneOffsetMs(timeZone, new Date(guess));
  let ts = guess - first;
  const second = zoneOffsetMs(timeZone, new Date(ts));
  if (second !== first) ts = guess - second;
  return new Date(ts);
}

/** ISO instant for midnight ET today, and N days back. */
export function opsDayStartIso(offsetDays = 0, now: Date = new Date()): string {
  return zonedStartOfDay(addDays(opsToday(now), offsetDays)).toISOString();
}

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: OPS_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: OPS_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** "Sep 27, 2026, 3:04 PM ET" */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${dateTimeFmt.format(d)} ET`;
}

/** "3:04 PM ET" */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${timeFmt.format(d)} ET`;
}

/** Calendar date (YYYY-MM-DD) as "Sep 30, 2026". Falls back to the raw value. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const day = value.slice(0, 10);
  return isISODate(day) ? formatShortDate(day) : value;
}

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "None";
  return formatCents(Math.round(cents));
}

/**
 * Parse a dollar amount typed by an operator ("7", "7.5", "1,049.00") into integer
 * cents. Returns null for anything that is not a non-negative amount with at most
 * two decimals.
 */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
  return whole * 100 + frac;
}

/** Cents as an input value: 700 -> "7.00". */
export function centsToDollarsInput(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  return `${Math.floor(safe / 100)}.${String(safe % 100).padStart(2, "0")}`;
}

/** First value of a search param. */
export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Human label for snake_case identifiers ("state_receipt" -> "State receipt"). */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const s = value.replace(/[_:.]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** ISO instant `days` days before now (rolling window, not calendar days). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
