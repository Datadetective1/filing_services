import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

export type FunnelStep = "details" | "review" | "payment" | "done";

const STEPS: { key: FunnelStep; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
  { key: "payment", label: "Payment" },
  { key: "done", label: "Done" },
];

/** Where the customer is in the order: Details, Review, Payment, Done. */
export function FunnelSteps({ current, paid = false, className }: { current: FunnelStep; paid?: boolean; className?: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Order progress" className={className}>
      <ol className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
        {STEPS.map((step, i) => {
          const done = i < currentIndex || (paid && step.key === "payment") || (current === "done" && step.key === "done");
          const isCurrent = i === currentIndex && current !== "done";
          return (
            <li key={step.key} className="flex min-w-0 items-center gap-2 sm:gap-3">
              {i > 0 ? <span aria-hidden className={cn("h-px w-3 shrink-0 sm:w-8", done || isCurrent ? "bg-fg/40" : "bg-border-strong")} /> : null}
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={cn("flex items-center gap-1.5 whitespace-nowrap", isCurrent ? "font-medium text-fg" : done ? "text-fg" : "text-subtle")}
              >
                <span
                  aria-hidden
                  className={cn(
                    "tnum grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                    done ? "bg-accent text-accent-fg" : isCurrent ? "bg-fg text-bg" : "border border-border-strong text-subtle",
                  )}
                >
                  {done ? <Check size={12} weight="bold" /> : i + 1}
                </span>
                <span className={isCurrent ? undefined : "max-sm:sr-only"}>{step.label}</span>
                {done ? <span className="sr-only">(complete)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
