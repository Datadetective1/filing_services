import { Check } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export interface NextStep {
  title: ReactNode;
  body?: ReactNode;
  state: "done" | "current" | "upcoming";
}

/** What happens next, as a short vertical timeline of stops. */
export function NextSteps({ steps, className, label }: { steps: NextStep[]; className?: string; label?: string }) {
  return (
    <ol aria-label={label} className={cn("grid", className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className={cn("relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3.5", last ? "" : "pb-5")}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-[13px] top-7",
                  s.state === "done" ? "w-0.5 bg-accent" : "w-0 border-l-2 border-dashed border-border-strong",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-7 place-items-center rounded-full border-2",
                s.state === "done"
                  ? "border-accent bg-accent text-accent-fg"
                  : s.state === "current"
                    ? "border-accent bg-surface text-accent ring-4 ring-accent/10"
                    : "border-border-strong bg-surface text-subtle",
              )}
            >
              {s.state === "done" ? (
                <Check size={14} weight="bold" />
              ) : (
                <span className="tnum font-display text-[12px] font-bold">{i + 1}</span>
              )}
            </span>
            <div className="grid gap-0.5 pt-[3px]">
              <p className="text-[15px] font-semibold leading-snug text-fg">
                {s.title}
                {s.state === "done" ? <span className="sr-only"> (done)</span> : null}
              </p>
              {s.body ? <p className="text-sm leading-6 text-muted">{s.body}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
