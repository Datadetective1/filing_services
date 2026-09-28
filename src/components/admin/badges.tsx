import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { describeDaysRemaining, daysBetween } from "@/lib/domain/dates";
import { FILING_STATUS_TONES, isFilingStatus, type StatusTone } from "@/lib/domain/filing-status";
import { formatDate } from "./format";
import { ADMIN_STATUS_LABELS } from "./status";
import {
  DEADLINE_SENSITIVE_STATUSES,
  URGENCY_DESCRIPTIONS,
  URGENCY_LABELS,
  URGENCY_TONES,
  WITH_STATE_STATUSES,
  urgencyFor,
} from "./urgency";

export function AdminStatusBadge({ status }: { status: string }) {
  if (!isFilingStatus(status)) return <Badge>{status}</Badge>;
  return <Badge tone={FILING_STATUS_TONES[status]}>{ADMIN_STATUS_LABELS[status]}</Badge>;
}

export function UrgencyBadge({ dueDate, today, status }: { dueDate: string; today: string; status: string }) {
  if (isFilingStatus(status) && !DEADLINE_SENSITIVE_STATUSES.includes(status)) {
    const withState = WITH_STATE_STATUSES.includes(status);
    return <Badge tone="neutral">{withState ? "With state" : status === "draft" ? "Unpaid" : "Closed"}</Badge>;
  }
  const level = urgencyFor(dueDate, today);
  return (
    <span title={URGENCY_DESCRIPTIONS[level]}>
      <Badge tone={URGENCY_TONES[level]}>{URGENCY_LABELS[level]}</Badge>
    </span>
  );
}

/** Due date plus days remaining; overdue shown in the danger color when it still matters. */
export function DeadlineText({
  dueDate,
  today,
  status,
  className,
}: {
  dueDate: string;
  today: string;
  status?: string;
  className?: string;
}) {
  const days = daysBetween(today, dueDate);
  const sensitive = !status || (isFilingStatus(status) && DEADLINE_SENSITIVE_STATUSES.includes(status));
  const overdue = days < 0 && sensitive;
  return (
    <span className={cn("tnum grid leading-tight", className)}>
      <span className="whitespace-nowrap text-fg">{formatDate(dueDate)}</span>
      {sensitive ? (
        <span className={cn("whitespace-nowrap text-xs", overdue ? "font-medium text-danger" : days <= 3 ? "text-warning" : "text-muted")}>
          {describeDaysRemaining(days)}
        </span>
      ) : null}
    </span>
  );
}

const GENERIC_TONES: Record<string, StatusTone> = {
  scheduled: "info",
  sent: "success",
  queued: "neutral",
  skipped: "neutral",
  cancelled: "neutral",
  suppressed: "neutral",
  failed: "danger",
  pending: "neutral",
  succeeded: "success",
  verified: "success",
  unverified: "warning",
};

/** Small status badge for reminders, emails, refunds and other secondary records. */
export function StatusPill({ status, tone }: { status: string; tone?: StatusTone }) {
  const label = status.replace(/_/g, " ");
  return <Badge tone={tone ?? GENERIC_TONES[status] ?? "neutral"}>{label.charAt(0).toUpperCase() + label.slice(1)}</Badge>;
}
