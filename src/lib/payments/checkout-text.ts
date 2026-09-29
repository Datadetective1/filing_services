import { site } from "@/config/site";
import type { CheckoutLineItem } from "./types";

/**
 * Wording sent to the payment processor (hosted checkout page, receipts, dashboard).
 * The state fee is named as a pass-through to the agency; our fee always carries the
 * brand, so neither can be read as a government charge.
 */

export function checkoutLineItemName(kind: CheckoutLineItem["kind"], agencyName: string): string {
  return kind === "government_fee" ? `${agencyName} filing fee (passed through at cost)` : `${site.name} service fee`;
}

export function checkoutDescription(input: { stateName: string; filingName: string; businessName: string }): string {
  const business = input.businessName.trim();
  return `${site.name} filing service: ${input.stateName} ${input.filingName}${business ? `, ${business}` : ""}`.slice(0, 200);
}
