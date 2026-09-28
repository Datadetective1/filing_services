import "server-only";
import { FilingError } from "@/lib/filings/customer";

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

/** A message that is safe and useful to show the customer. Never leaks internals. */
export function friendlyError(e: unknown): string {
  if (e instanceof FilingError) {
    // Service errors that wrap a database message are not customer-facing.
    if (e.code === "invalid" && /^could not/i.test(e.message)) {
      console.error("[filing]", e.message);
      return GENERIC;
    }
    return e.message.replace(/[\u2013\u2014]/g, "-");
  }
  if (e instanceof Error && e.name === "PaymentConfigurationError") {
    console.error("[payments]", e.message);
    return "Payments aren't available right now. Please try again later.";
  }
  console.error("[filing] unexpected error", e);
  return GENERIC;
}

export function filingErrorCode(e: unknown): FilingError["code"] | null {
  return e instanceof FilingError ? e.code : null;
}

/** Matches the id format getCustomerFiling accepts. */
export const FILING_ID_RE = /^[0-9a-f-]{36}$/i;
