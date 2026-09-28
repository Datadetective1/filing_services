/**
 * Filing status machine. The database function public.filing_transition_allowed()
 * is the enforcement point; this module mirrors it for the UI. A DB test asserts
 * that both agree on every (from, to) pair.
 */

export const FILING_STATUSES = [
  "draft",
  "needs_information",
  "ready_for_review",
  "ready_to_file",
  "in_progress",
  "submitted",
  "accepted",
  "rejected",
  "needs_customer_action",
  "completed",
  "cancelled",
  "refunded",
] as const;
export type FilingStatus = (typeof FILING_STATUSES)[number];

export const FILING_TRANSITIONS: Record<FilingStatus, readonly FilingStatus[]> = {
  draft: ["needs_information", "ready_for_review", "cancelled"],
  needs_information: ["ready_for_review", "cancelled"],
  ready_for_review: ["ready_to_file", "needs_customer_action", "cancelled"],
  ready_to_file: ["in_progress", "submitted", "needs_customer_action", "cancelled"],
  in_progress: ["submitted", "ready_to_file", "needs_customer_action", "cancelled"],
  submitted: ["accepted", "rejected"],
  accepted: ["completed"],
  rejected: ["needs_customer_action", "ready_to_file", "cancelled"],
  needs_customer_action: ["ready_for_review", "cancelled"],
  completed: ["ready_for_review"],
  cancelled: ["refunded", "ready_for_review"],
  refunded: [],
};

export function canTransition(from: FilingStatus, to: FilingStatus): boolean {
  return FILING_TRANSITIONS[from].includes(to);
}

export function isFilingStatus(value: unknown): value is FilingStatus {
  return typeof value === "string" && (FILING_STATUSES as readonly string[]).includes(value);
}

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  draft: "Not started",
  needs_information: "Needs information",
  ready_for_review: "Ready for review",
  ready_to_file: "Ready to file",
  in_progress: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  needs_customer_action: "Needs your action",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** What the customer sees under the status badge. */
export const CUSTOMER_STATUS_DESCRIPTIONS: Record<FilingStatus, string> = {
  draft: "Finish your details and checkout to place the order.",
  needs_information: "We need a few more details before we can prepare your filing.",
  ready_for_review: "We're reviewing your information before filing.",
  ready_to_file: "Your filing is prepared and queued for submission.",
  in_progress: "We're submitting your filing with the state.",
  submitted: "Submitted to the state. We'll confirm once it's accepted.",
  accepted: "The state accepted your filing.",
  rejected: "The state rejected the filing. We'll contact you with next steps.",
  needs_customer_action: "We need something from you to continue. See messages.",
  completed: "Done. Your filed report and state receipt are available below.",
  cancelled: "This filing was cancelled.",
  refunded: "This filing was cancelled and refunded.",
};

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export const FILING_STATUS_TONES: Record<FilingStatus, StatusTone> = {
  draft: "neutral",
  needs_information: "warning",
  ready_for_review: "info",
  ready_to_file: "info",
  in_progress: "info",
  submitted: "info",
  accepted: "success",
  rejected: "danger",
  needs_customer_action: "warning",
  completed: "success",
  cancelled: "neutral",
  refunded: "neutral",
};

/** What the operator needs to do next — the "Required action" column in the queue. */
export const OPERATOR_NEXT_ACTION: Record<FilingStatus, string> = {
  draft: "—",
  needs_information: "Waiting on customer intake",
  ready_for_review: "Review details",
  ready_to_file: "File with state",
  in_progress: "Finish submission",
  submitted: "Confirm acceptance",
  accepted: "Upload receipt & complete",
  rejected: "Resolve rejection",
  needs_customer_action: "Waiting on customer",
  completed: "—",
  cancelled: "Refund if owed",
  refunded: "—",
};

/** Statuses where the filing is in our hands and paid for. */
export const ACTIVE_OPERATIONS_STATUSES: readonly FilingStatus[] = [
  "needs_information",
  "ready_for_review",
  "ready_to_file",
  "in_progress",
  "submitted",
  "accepted",
  "rejected",
  "needs_customer_action",
];

/** Once here, the state has the filing: customer deadline reminders stop. */
export const FILED_STATUSES: readonly FilingStatus[] = ["submitted", "accepted", "completed"];

export const TERMINAL_STATUSES: readonly FilingStatus[] = ["completed", "cancelled", "refunded"];

/** Statuses in which the customer may still edit their intake answers. */
export const CUSTOMER_EDITABLE_STATUSES: readonly FilingStatus[] = [
  "draft",
  "needs_information",
  "needs_customer_action",
];
