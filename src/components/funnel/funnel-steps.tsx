import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

export type FunnelStep = "details" | "review" | "payment" | "done";

const STEPS: { key: FunnelStep; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
  { key: "payment", label: "Payment" },
  { key: "done", label: "Done" },
];

/**
 * Where the customer is in the order: Details, Review, Payment, Done. A track of four
 * stops that fills in pine as each one is finished.
 */
export function FunnelSteps({ current, paid = false, className }: { current: FunnelStep; paid?: boolean; className?: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Order progress" className={cn("max-w-md", className)}>
      <ol className="grid grid-cols-4">
        {STEPS.map((step, i) => {
          const done = i < currentIndex || (paid && step.key === "payment") || (current === "done" && step.key === "done");
          const isCurrent = i === currentIndex && current !== "done";
          const reached = done || isCurrent;
          return (
            <li key={step.key} className="relative grid justify-items-center gap-1.5 text-center">
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-[15px] w-full",
                    reached ? "h-0.5 bg-accent" : "h-0 border-t-2 border-dashed border-border-strong",
                  )}
                />
              ) : null}
              <span
                aria-current={isCurrent ? "step" : undefined}
                className="relative z-10 grid justify-items-center gap-1.5"
              >
                <span
                  aria-hidden
                  className={cn(
                    "tnum grid size-8 place-items-center rounded-full border-2 font-display text-[13px] font-bold transition-colors",
                    done
                      ? "border-accent bg-accent text-accent-fg"
                      : isCurrent
                        ? "border-accent bg-surface text-accent ring-4 ring-accent/12"
                        : "border-border-strong bg-bg text-subtle",
                  )}
                >
                  {done ? <Check size={15} weight="bold" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-[13px]",
                    isCurrent ? "font-semibold text-fg" : done ? "font-medium text-fg" : "font-medium text-subtle",
                  )}
                >
                  {step.label}
                  {done ? <span className="sr-only"> (complete)</span> : null}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
