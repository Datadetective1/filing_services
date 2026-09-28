import type { ISODate } from "./types";

/**
 * Calendar-date helpers. Filing deadlines are calendar dates in the state's time
 * zone, so all comparisons are done on YYYY-MM-DD strings, never on instants.
 */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: string): value is ISODate {
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function toISODate(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseISODate(value: ISODate): { year: number; month: number; day: number } {
  if (!isISODate(value)) throw new Error(`Invalid ISO date: ${value}`);
  const [y, m, d] = value.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** Today's calendar date in the given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUTC(value: ISODate): number {
  const { year, month, day } = parseISODate(value);
  return Date.UTC(year, month - 1, day);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

export function addDays(value: ISODate, days: number): ISODate {
  const d = new Date(toUTC(value) + days * 86_400_000);
  return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function compareISODate(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatLongDate(value: ISODate): string {
  const { year, month, day } = parseISODate(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortDate(value: ISODate): string {
  const { year, month, day } = parseISODate(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "June 30" — month and day only, for recurring deadlines. */
export function formatMonthDay(month: number, day: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(2001, month - 1, day)),
  );
}

export function describeDaysRemaining(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `${days} days left`;
  if (days === -1) return "1 day past due";
  return `${Math.abs(days)} days past due`;
}
