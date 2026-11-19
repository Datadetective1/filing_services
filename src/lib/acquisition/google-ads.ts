/**
 * Google Ads offline conversions: live paid orders whose buyer arrived from a Google Ads
 * click, as the CSV Google Ads accepts under Goals > Conversions > Uploads. Pure helpers;
 * the admin route does the I/O. Nothing here sends anything to Google: an admin downloads
 * the file and uploads it by hand.
 */

export const GOOGLE_ADS_TIME_ZONE = "America/Chicago";
export const DEFAULT_CONVERSION_NAME = "Filewell purchase";
/** Google Ads only accepts conversions for clicks from the last 90 days. */
export const UPLOAD_WINDOW_DAYS = 90;

export interface ConversionRow {
  clickId: string;
  /** When the order was paid (ISO timestamp). */
  paidAt: string;
  /** Filewell's own service fee in cents (state fees excluded). */
  valueCents: number;
}

/** "yyyy-MM-dd HH:mm:ss" in the given time zone, the format the upload template uses. */
export function googleAdsTime(iso: string, timeZone = GOOGLE_ADS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** A conversion name safe to put in a CSV cell (no quotes, commas or line breaks). */
export function cleanConversionName(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/[^A-Za-z0-9 _.-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return s || DEFAULT_CONVERSION_NAME;
}

export function conversionsCsv(rows: ConversionRow[], conversionName: string = DEFAULT_CONVERSION_NAME): string {
  const name = cleanConversionName(conversionName);
  const lines = [
    `Parameters:TimeZone=${GOOGLE_ADS_TIME_ZONE}`,
    "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
  ];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(r.clickId)) continue;
    const key = `${r.clickId}|${r.paidAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push([r.clickId, name, googleAdsTime(r.paidAt), (Math.max(0, r.valueCents) / 100).toFixed(2), "USD"].join(","));
  }
  return `${lines.join("\n")}\n`;
}
