import { site } from "@/config/site";
import type { FilingStatus } from "@/lib/domain/filing-status";

/**
 * Display helpers for the customer dashboard. Pure functions, safe to import from
 * server and client components.
 */

const DISPLAY_TIME_ZONE = "America/New_York";

const timestampFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

const timestampDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sep 27, 2026, 3:04 PM EDT" (always Eastern time). */
export function formatTimestamp(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? timestampFormat.format(d) : "Not available";
}

/** "Sep 27, 2026" for a timestamp, in Eastern time. */
export function formatTimestampDate(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? timestampDateFormat.format(d) : "Not available";
}

/** PostgREST returns embedded to-one relations as an object or a one-element array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function many<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/** Only render links to https URLs we stored ourselves (receipts, official sources). */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const TEAM_NAME = `${site.name} team`;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type RequirementStatus = "open" | "filed_with_us" | "filed_elsewhere" | "not_required" | "cancelled";

export const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  open: "Open",
  filed_with_us: `Filed with ${site.name}`,
  filed_elsewhere: "Filed elsewhere",
  not_required: "Not required",
  cancelled: "Cancelled",
};

export function requirementStatusLabel(status: string): string {
  return REQUIREMENT_STATUS_LABELS[status as RequirementStatus] ?? status;
}

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  state_receipt: "State receipt",
  filed_report: "Filed report",
  acknowledgement: "State acknowledgement",
  filing_packet: "Filing packet",
  customer_upload: "Your upload",
  other: "Document",
};

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  queued: "Sending",
  sent: "Sent",
  failed: "Not delivered",
  suppressed: "Not sent",
};

export const STANDING_LABELS: Record<string, string> = {
  unknown: "Unknown",
  active: "Active",
  inactive: "Inactive",
  not_in_good_standing: "Not in good standing",
};

/**
 * Standing is only described as coming from the state when it really did. We have
 * no registry integration yet, so most businesses read "Not checked with the state".
 */
export function standingText(standing: string, source: string): string {
  const label = STANDING_LABELS[standing] ?? standing;
  if (source === "state_registry") return `From state records: ${label}`;
  if (source === "customer_reported") return `Reported by you: ${label}`;
  return "Not checked with the state";
}

/** Readable timeline wording for a status change. */
export function timelineLabel(to: FilingStatus, from: string | null): string {
  switch (to) {
    case "draft":
      return "Filing started";
    case "needs_information":
      return from === "draft" ? "Order placed, a few details still needed" : "We asked for more details";
    case "ready_for_review":
      if (from === "draft") return "Order placed and in review";
      if (from === "needs_information" || from === "needs_customer_action") return "Back in review";
      if (from === "completed" || from === "cancelled") return "Reopened for review";
      return "In review";
    case "ready_to_file":
      return "Prepared and queued for filing";
    case "in_progress":
      return "Filing with the state";
    case "submitted":
      return "Submitted to the state";
    case "accepted":
      return "Accepted by the state";
    case "rejected":
      return "Rejected by the state";
    case "needs_customer_action":
      return "Waiting on you";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
  }
}

export function actorLabel(actorType: string): string {
  if (actorType === "customer") return "You";
  if (actorType === "staff") return TEAM_NAME;
  return site.name;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
