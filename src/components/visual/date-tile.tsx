import { cn } from "@/components/ui/cn";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A due date drawn as a tear-off calendar leaf (month on pine, day below).
 * Decorative: the date is always written out in text next to it.
 */
export function DateTile({ date, size = "md", className }: { date: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const [, m, d] = date.slice(0, 10).split("-").map(Number);
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 overflow-hidden rounded-[10px] border border-border bg-surface text-center shadow-[0_1px_2px_rgb(23_35_29/0.05)]",
        size === "sm" ? "w-12" : size === "lg" ? "w-[76px]" : "w-16",
        className,
      )}
    >
      <span
        className={cn(
          "bg-accent font-bold uppercase tracking-wider text-accent-fg",
          size === "sm" ? "py-px text-[10px]" : "py-0.5 text-[11px]",
        )}
      >
        {MONTHS[(m || 1) - 1]}
      </span>
      <span
        className={cn(
          "tnum font-display font-semibold leading-none text-fg",
          size === "sm" ? "py-1.5 text-xl" : size === "lg" ? "py-2.5 text-[32px]" : "py-2 text-2xl",
        )}
      >
        {d}
      </span>
    </span>
  );
}
