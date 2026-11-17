/**
 * Name of the cookie that remembers a visitor came for a registered agent (see intent.ts).
 * A plain module so the proxy can read and clear it without importing server-only code.
 */
export const SERVICE_INTENT_COOKIE = "fw_service_intent";

/**
 * Pages that are only about the annual report. A visitor who opens one is here for the
 * annual report now, so a registered agent choice from earlier must not turn the next
 * business lookup into the agent order.
 */
export function isAnnualReportPath(pathname: string): boolean {
  return pathname === "/annual-report" || pathname.startsWith("/annual-report/") || /^\/[a-z-]+\/annual-report-/.test(pathname);
}
