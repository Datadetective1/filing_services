import { describeDaysRemaining, formatLongDate, formatShortDate } from "@/lib/domain/dates";
import { ACTIVE_OPERATIONS_STATUSES, FILED_STATUSES } from "@/lib/domain/filing-status";
import { cn } from "@/components/ui/cn";
import type { RequirementView } from "@/app/(app)/dashboard/_lib/data";

/** True once the customer has paid and the filing is with us or the state. */
export function isHandledByUs(requirement: RequirementView): boolean {
  const status = requirement.activeFiling?.status;
  if (!status) return false;
  return (
    FILED_STATUSES.includes(status) ||
    (ACTIVE_OPERATIONS_STATUSES.includes(status) && status !== "needs_information" && status !== "needs_customer_action")
  );
}

/** Days-remaining text, calm by default; past-due gets the warning color, never red. */
export function DaysRemaining({ requirement, className }: { requirement: RequirementView; className?: string }) {
  if (requirement.status !== "open") return null;
  if (isHandledByUs(requirement)) {
    const filed = requirement.activeFiling && FILED_STATUSES.includes(requirement.activeFiling.status);
    return <span className={cn("text-muted", className)}>{filed ? "With the state" : "We're handling it"}</span>;
  }
  const days = requirement.daysRemaining;
  return (
    <span
      className={cn(
        "tnum",
        days < 0 ? "font-medium text-warning" : days <= 30 ? "font-medium text-fg" : "text-muted",
        className,
      )}
    >
      {describeDaysRemaining(days)}
    </span>
  );
}

export function DueDate({ value, short = false }: { value: string; short?: boolean }) {
  return (
    <time dateTime={value} className="tnum">
      {short ? formatShortDate(value) : formatLongDate(value)}
    </time>
  );
}
