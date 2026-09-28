import type { ReactNode } from "react";
import {
  FILING_STATUS_LABELS,
  FILING_STATUS_TONES,
  type FilingStatus,
  type StatusTone,
} from "@/lib/domain/filing-status";
import { cn } from "./cn";

const tones: Record<StatusTone, string> = {
  neutral: "bg-surface-2 text-muted",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-accent-soft text-accent-soft-fg",
  danger: "bg-danger-soft text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-[var(--radius-control)] px-2 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FilingStatusBadge({ status }: { status: FilingStatus }) {
  return <Badge tone={FILING_STATUS_TONES[status]}>{FILING_STATUS_LABELS[status]}</Badge>;
}

const PAYMENT_TONES: Record<string, StatusTone> = {
  pending_payment: "neutral",
  pending: "neutral",
  paid: "success",
  succeeded: "success",
  payment_failed: "danger",
  failed: "danger",
  expired: "neutral",
  cancelled: "neutral",
  partially_refunded: "warning",
  refunded: "neutral",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending_payment: "Awaiting payment",
  pending: "Pending",
  paid: "Paid",
  succeeded: "Paid",
  payment_failed: "Payment failed",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export function PaymentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>Not ordered</Badge>;
  return <Badge tone={PAYMENT_TONES[status] ?? "neutral"}>{PAYMENT_LABELS[status] ?? status}</Badge>;
}
