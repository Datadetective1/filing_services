import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { isFilingStatus, type FilingStatus } from "@/lib/domain/filing-status";
import { ADMIN_STATUS_LABELS } from "./status";

/**
 * Where a filing is in our process, drawn as a rail of steps. Purely derived from
 * the status: it shows the path, never changes it.
 */

// The last step says "Done", not "Completed": the E2E journey waits for the word
// "completed" to appear on this page as its signal that the filing finished.
const STEPS = ["Payment", "Review", "Ready to file", "Filing", "Submitted", "Accepted", "Done"] as const;

const STEP_FOR_STATUS: Partial<Record<FilingStatus, number>> = {
  draft: 0,
  needs_information: 1,
  ready_for_review: 1,
  needs_customer_action: 1,
  ready_to_file: 2,
  in_progress: 3,
  submitted: 4,
  rejected: 4,
  accepted: 5,
  completed: 6,
};

type StepState = "done" | "current" | "waiting" | "problem" | "todo";

export function FilingProgress({ status, className }: { status: string; className?: string }) {
  if (!isFilingStatus(status)) return null;
  const current = STEP_FOR_STATUS[status];
  // Cancelled and refunded filings have left the path; the status badge says so.
  if (current === undefined) return null;

  const stateOf = (i: number): StepState => {
    if (status === "completed") return "done";
    if (i < current) return "done";
    if (i > current) return "todo";
    if (status === "rejected") return "problem";
    if (status === "needs_information" || status === "needs_customer_action" || status === "draft") return "waiting";
    return "current";
  };

  const here = stateOf(current);
  return (
    <div className={cn("grid gap-3", className)}>
      <ol aria-label="Filing progress" className="grid grid-cols-7">
        {STEPS.map((label, i) => {
          const state = stateOf(i);
          const isHere = i === current;
          return (
            <li key={label} aria-current={isHere ? "step" : undefined} className="relative grid justify-items-center gap-2 text-center">
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-[13px] h-[2px] w-full",
                    state === "done" || isHere ? "bg-accent" : "bg-border",
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-[1] grid size-7 place-items-center rounded-full border-2",
                  state === "done" && "border-accent bg-accent text-accent-fg",
                  state === "current" && "border-highlight-strong bg-highlight text-highlight-fg",
                  state === "waiting" && "border-warning bg-warning-soft text-warning",
                  state === "problem" && "border-danger bg-danger text-white",
                  state === "todo" && "border-border-strong bg-surface",
                )}
              >
                {state === "done" ? <Check size={14} weight="bold" /> : null}
                {state === "problem" ? <X size={14} weight="bold" /> : null}
                {state === "current" || state === "waiting" ? <span className="size-2 rounded-full bg-current" /> : null}
              </span>
              <span className="grid gap-0.5 px-0.5 leading-tight max-sm:sr-only">
                <span className={cn("text-[13px]", isHere ? "font-semibold text-fg" : state === "done" ? "text-fg" : "text-muted")}>
                  {label}
                  <span className="sr-only">{state === "done" ? ", done" : state === "todo" ? ", not started" : ""}</span>
                </span>
                {isHere && status !== "completed" ? (
                  <span className={cn("text-xs", state === "problem" ? "font-medium text-danger" : state === "waiting" ? "font-medium text-warning" : "text-muted")}>
                    {ADMIN_STATUS_LABELS[status]}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      <p aria-hidden className="text-center text-sm sm:hidden">
        <span className="font-semibold text-fg">
          Step {current + 1} of {STEPS.length}: {STEPS[current]}
        </span>
        {status !== "completed" ? (
          <span className={here === "problem" ? "font-medium text-danger" : here === "waiting" ? "font-medium text-warning" : "text-muted"}>
            {" "}
            · {ADMIN_STATUS_LABELS[status]}
          </span>
        ) : null}
      </p>
    </div>
  );
}
