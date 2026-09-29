import { describeDaysRemaining, formatLongDate, formatShortDate, parseISODate } from "@/lib/domain/dates";
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
        days < 0 ? "font-semibold text-warning" : days <= 30 ? "font-semibold text-fg" : "text-muted",
        className,
      )}
    >
      {describeDaysRemaining(days)}
    </span>
  );
}

/** Accessible description for a countdown ring, e.g. "2 days until the September 30, 2026 deadline". */
export function deadlineRingLabel(days: number, due: string): string {
  const date = formatLongDate(due);
  const n = Math.abs(days);
  if (days < 0) return `${n} ${n === 1 ? "day" : "days"} past the ${date} deadline`;
  if (days === 0) return `Due today, ${date}`;
  return `${n} ${n === 1 ? "day" : "days"} until the ${date} deadline`;
}

export function DueDate({ value, short = false }: { value: string; short?: boolean }) {
  return (
    <time dateTime={value} className="tnum">
      {short ? formatShortDate(value) : formatLongDate(value)}
    </time>
  );
}

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/**
 * A due date drawn as a tear-off calendar leaf (month band, day, year). Decorative:
 * the date is always also written out in text next to it.
 */
export function DateChip({
  value,
  tone = "default",
  size = "md",
  className,
}: {
  value: string;
  tone?: "default" | "late" | "quiet";
  size?: "sm" | "md";
  className?: string;
}) {
  const { year, month, day } = parseISODate(value);
  const label = monthFormat.format(new Date(Date.UTC(year, month - 1, day)));
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 overflow-hidden rounded-[10px] border bg-surface text-center shadow-[0_1px_0_rgb(23_35_29/0.04)]",
        size === "sm" ? "w-12" : "w-16",
        tone === "late" ? "border-highlight-strong/50" : "border-border",
        className,
      )}
    >
      <span
        className={cn(
          "font-bold uppercase tracking-wider",
          size === "sm" ? "py-px text-[10px]" : "py-0.5 text-[11px]",
          tone === "late"
            ? "bg-highlight text-highlight-fg"
            : tone === "quiet"
              ? "bg-surface-3 text-fg"
              : "bg-accent text-accent-fg",
        )}
      >
        {label}
      </span>
      <span className={cn("tnum font-display font-semibold leading-none text-fg", size === "sm" ? "pt-1 text-lg" : "pt-1.5 text-2xl")}>
        {day}
      </span>
      <span className={cn("tnum font-medium text-muted", size === "sm" ? "pb-1 text-[10px]" : "pb-1.5 pt-0.5 text-[11px]")}>{year}</span>
    </span>
  );
}
