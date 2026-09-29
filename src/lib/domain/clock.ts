/**
 * "Now" for customer-facing business dates (deadlines, countdowns, filing periods).
 *
 * Outside production, FILEWELL_CLOCK_OVERRIDE (an ISO timestamp) pins this clock so
 * date transitions such as the September 30 deadline can be checked end to end in a
 * local or preview build. Production always uses the real time. Record timestamps
 * and the reminder engine use the real clock regardless.
 */
export function businessNow(): Date {
  const override = process.env.FILEWELL_CLOCK_OVERRIDE;
  const production = process.env.VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  if (override && !production) {
    const pinned = new Date(override);
    if (!Number.isNaN(pinned.getTime())) return pinned;
  }
  return new Date();
}
