import { cn } from "@/components/ui/cn";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A due date drawn as a tear-off calendar tile (pine month band, big day number).
 * Decorative by default: the date is always written out in text next to it.
 */
export function CalendarDate({
  month,
  day,
  size = "md",
  tone = "accent",
  className,
}: {
  /** 1-12, or null when the rule has no fixed date. */
  month: number | null;
  day: number | null;
  size?: "sm" | "md" | "lg";
  tone?: "accent" | "muted";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 overflow-hidden rounded-[10px] border bg-surface text-center shadow-[0_1px_0_rgb(23_35_29/0.04)]",
        tone === "accent" ? "border-border" : "border-dashed border-border-strong",
        size === "sm" ? "w-12" : size === "lg" ? "w-[4.5rem]" : "w-14",
        className,
      )}
    >
      <span
        className={cn(
          "font-bold uppercase tracking-wider",
          tone === "accent" ? "bg-accent text-accent-fg" : "bg-surface-2 text-subtle",
          size === "sm" ? "py-px text-[10px]" : "py-0.5 text-[11px]",
        )}
      >
        {month ? MONTHS[month - 1] : "Due"}
      </span>
      <span
        className={cn(
          "tnum font-display font-semibold leading-none",
          tone === "accent" ? "text-fg" : "text-subtle",
          size === "sm" ? "py-1.5 text-lg" : size === "lg" ? "py-2.5 text-[28px]" : "py-2 text-[22px]",
        )}
      >
        {day ?? "?"}
      </span>
    </span>
  );
}
