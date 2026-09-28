import { CUSTOMER_EDITABLE_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";

/**
 * Where the customer goes next for a filing. The intake flow lives under
 * /file/[id]/...; the step slugs are kept in one place here.
 */
export const FILE_STEPS = {
  details: (filingId: string) => `/file/${filingId}/details`,
  review: (filingId: string) => `/file/${filingId}/review`,
  checkout: (filingId: string) => `/file/${filingId}/checkout`,
} as const;

export function filingHref(filingId: string): string {
  return `/dashboard/filings/${filingId}`;
}

export function businessHref(businessId: string): string {
  return `/dashboard/businesses/${businessId}`;
}

export interface StepInput {
  id: string;
  status: FilingStatus;
  /** filing_answers.is_complete */
  isComplete: boolean;
  /** At least one filing_authorizations row exists. */
  authorized: boolean;
  /** orders.status, when an order exists. */
  orderStatus?: string | null;
}

export type NextStepKind = "details" | "review" | "checkout" | "retry_payment" | "reply" | "none";

export interface NextStep {
  kind: NextStepKind;
  href: string | null;
  title: string;
  body: string;
  cta: string | null;
}

export function isCustomerEditable(status: FilingStatus): boolean {
  return CUSTOMER_EDITABLE_STATUSES.includes(status);
}

/** The single next thing the customer should do for a filing, if anything. */
export function nextCustomerStep(f: StepInput): NextStep {
  switch (f.status) {
    case "draft": {
      if (!f.isComplete) {
        return {
          kind: "details",
          href: FILE_STEPS.details(f.id),
          title: "Finish your business details",
          body: "A few details are still missing. Your progress is saved, so you can pick up where you left off.",
          cta: "Continue",
        };
      }
      if (!f.authorized) {
        return {
          kind: "review",
          href: FILE_STEPS.review(f.id),
          title: "Review and authorize",
          body: "Check your information and authorize us to file on your behalf.",
          cta: "Review and authorize",
        };
      }
      if (f.orderStatus === "payment_failed" || f.orderStatus === "expired") {
        return {
          kind: "retry_payment",
          href: FILE_STEPS.checkout(f.id),
          title: "Your payment didn't go through",
          body: "Nothing was charged. You can try again with the same or a different card.",
          cta: "Try payment again",
        };
      }
      return {
        kind: "checkout",
        href: FILE_STEPS.checkout(f.id),
        title: "Place your order",
        body: "Your details are complete and authorized. Pay to place the order and we'll take it from there.",
        cta: "Go to payment",
      };
    }
    case "needs_information":
      return f.isComplete
        ? {
            kind: "review",
            href: FILE_STEPS.review(f.id),
            title: "Confirm your updated details",
            body: "Review the information and authorize the filing again so we can continue.",
            cta: "Review and authorize",
          }
        : {
            kind: "details",
            href: FILE_STEPS.details(f.id),
            title: "Add the missing details",
            body: "Your order is placed. We need a few more details before we can prepare the filing.",
            cta: "Add details",
          };
    case "needs_customer_action":
      return {
        kind: "reply",
        href: `${filingHref(f.id)}#messages`,
        title: "We need something from you",
        body: "Read our message below and reply. If a detail needs to change, you can update it and authorize again.",
        cta: "Read and reply",
      };
    default:
      return { kind: "none", href: null, title: "", body: "", cta: null };
  }
}

/** Href for the dashboard's "Continue" button on an editable filing. */
export function continueHref(f: StepInput): string {
  return nextCustomerStep(f).href ?? filingHref(f.id);
}
