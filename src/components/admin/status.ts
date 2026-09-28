import { FILING_STATUS_LABELS, type FilingStatus } from "@/lib/domain/filing-status";

/** Operator wording differs from the customer's in a few places. */
export const ADMIN_STATUS_LABELS: Record<FilingStatus, string> = {
  ...FILING_STATUS_LABELS,
  draft: "Draft (unpaid)",
  needs_information: "Needs intake info",
  needs_customer_action: "Waiting on customer",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  payment_failed: "Payment failed",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  cancelled: "Cancelled",
  expired: "Expired",
};

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  state_receipt: "State receipt",
  filed_report: "Filed report",
  acknowledgement: "Acknowledgement letter",
  filing_packet: "Filing packet",
  customer_upload: "Customer upload",
  other: "Other",
};
