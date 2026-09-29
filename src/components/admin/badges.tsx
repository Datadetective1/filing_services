import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { describeDaysRemaining, daysBetween } from "@/lib/domain/dates";
import { FILING_STATUS_TONES, isFilingStatus, type StatusTone } from "@/lib/domain/filing-status";
import { formatDate, humanize } from "./format";
import { isTestPayment, TEST_ORDER_LABEL } from "./operator-guidance";
import { ADMIN_STATUS_LABELS, ORDER_STATUS_LABELS } from "./status";
import {
  DEADLINE_SENSITIVE_STATUSES,
  URGENCY_DESCRIPTIONS,
  URGENCY_LABELS,
  WITH_STATE_STATUSES,
  urgencyFor,
  type Urgency,
} from "./urgency";

export function AdminStatusBadge({ status }: { status: string }) {
  if (!isFilingStatus(status)) return <Badge>{status}</Badge>;
  return <Badge tone={FILING_STATUS_TONES[status]}>{ADMIN_STATUS_LABELS[status]}</Badge>;
}

/**
 * Urgency uses the marigold highlight for "act now" and red only for late: solid red
 * when overdue, solid marigold when due within 3 days, soft marigold within 14.
 */
const URGENCY_CHIP: Record<Urgency, { chip: string; dot: string }> = {
  overdue: { chip: "bg-danger text-white", dot: "bg-white" },
  critical: { chip: "bg-highlight text-highlight-fg", dot: "bg-highlight-fg" },
  soon: { chip: "bg-highlight-soft text-highlight-fg", dot: "bg-highlight-strong" },
  normal: { chip: "bg-surface-2 text-muted", dot: "bg-subtle/60" },
};

function Chip({ className, dotClassName, children }: { className: string; dotClassName: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold", className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dotClassName)} />
      {children}
    </span>
  );
}

export function UrgencyBadge({ dueDate, today, status }: { dueDate: string; today: string; status: string }) {
  if (isFilingStatus(status) && !DEADLINE_SENSITIVE_STATUSES.includes(status)) {
    const withState = WITH_STATE_STATUSES.includes(status);
    return <Badge tone="neutral">{withState ? "With state" : status === "draft" ? "Unpaid" : "Closed"}</Badge>;
  }
  const level = urgencyFor(dueDate, today);
  const style = URGENCY_CHIP[level];
  return (
    <span title={URGENCY_DESCRIPTIONS[level]}>
      <Chip className={style.chip} dotClassName={style.dot}>
        {URGENCY_LABELS[level]}
      </Chip>
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
    <span className={cn("tnum grid gap-0.5 leading-tight", className)}>
      <span className="whitespace-nowrap font-medium text-fg">{formatDate(dueDate)}</span>
      {sensitive ? (
        <span
          className={cn(
            "whitespace-nowrap text-xs",
            overdue ? "font-semibold text-danger" : days <= 3 ? "font-semibold text-warning" : days <= 14 ? "text-warning" : "text-muted",
          )}
        >
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

/**
 * Shown wherever an order is shown when its payment was not live (sandbox or test
 * mode): no money was collected, so the order must never be filed with the state.
 */
export function TestOrderBadge({ mode, compact = false }: { mode: string | null | undefined; compact?: boolean }) {
  if (!isTestPayment(mode)) return null;
  // Compact form for narrow cells; the full sentence stays available to screen readers and on hover.
  if (compact) {
    return (
      <span title={TEST_ORDER_LABEL}>
        <Badge tone="danger">
          TEST<span className="sr-only">: no money collected</span>
        </Badge>
      </span>
    );
  }
  return <Badge tone="danger">{TEST_ORDER_LABEL}</Badge>;
}

const PAYMENT_DOTS: Record<string, string> = {
  paid: "bg-accent",
  partially_refunded: "bg-highlight-strong",
  payment_failed: "bg-danger",
};

/** Order payment state as a quiet line of text, for tables that already show a status badge. */
export function PaymentLine({ status }: { status: string | null | undefined }) {
  const label = status ? (ORDER_STATUS_LABELS[status] ?? humanize(status)) : "Not ordered";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", status === "payment_failed" ? "font-semibold text-danger" : "text-muted")}>
      <span aria-hidden className={cn("size-1.5 rounded-full", (status && PAYMENT_DOTS[status]) || "bg-subtle/60")} />
      {label}
    </span>
  );
}
