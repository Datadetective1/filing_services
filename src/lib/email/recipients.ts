/**
 * Reserved and test-only recipient domains (RFC 2606 / RFC 6761, plus the E2E
 * suite's domain). Mail to them can never arrive: sending would only bounce and
 * hurt the sending domain's reputation, so they are never handed to a provider.
 */
const RESERVED_SUFFIXES = [".test", ".example", ".invalid", ".localhost"];
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net", "e2e.filewell.test", "localhost"];

export const RESERVED_ADDRESS_REASON = "reserved test address";

export function isReservedTestAddress(address: string): boolean {
  const at = address.lastIndexOf("@");
  if (at < 0) return false;
  const domain = address
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/[>\s]+$/, "")
    .replace(/\.$/, "");
  if (!domain) return false;
  if (RESERVED_SUFFIXES.some((s) => domain.endsWith(s))) return true;
  return RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}
