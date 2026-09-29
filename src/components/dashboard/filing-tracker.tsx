import { Check, ExclamationMark, X } from "@phosphor-icons/react/dist/ssr";
import type { FilingStatus } from "@/lib/domain/filing-status";
import { cn } from "@/components/ui/cn";

/**
 * The filing lifecycle as five steps: details, authorized, paid, submitted,
 * accepted. Derived purely from the filing's existing status fields; it never
 * decides anything, it only draws where the filing already is.
 */

export type TrackerKey = "details" | "authorized" | "paid" | "submitted" | "accepted";
type StepState = "done" | "current" | "attention" | "problem" | "upcoming";

export interface TrackerStep {
  key: TrackerKey;
  label: string;
  state: StepState;
  caption: string | null;
}

export interface TrackerInput {
  status: FilingStatus;
  isComplete: boolean;
  authorized: boolean;
  orderStatus?: string | null;
}

const LABELS: Record<TrackerKey, string> = {
  details: "Details",
  authorized: "Authorized",
  paid: "Paid",
  submitted: "Submitted",
  accepted: "Accepted",
};

const PAID_ORDER_STATUSES = new Set(["paid", "partially_refunded", "refunded"]);

const shortDate = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : shortDate.format(d);
}

function currentCaption(key: TrackerKey, f: TrackerInput): string {
  switch (key) {
    case "details":
      return "Add details";
    case "authorized":
      return "Review and sign";
    case "paid":
      return "Checkout";
    case "submitted":
      if (f.status === "ready_for_review") return "We're reviewing";
      if (f.status === "ready_to_file") return "Queued to file";
      if (f.status === "in_progress") return "Filing now";
      return "Next";
    case "accepted":
      return f.status === "submitted" ? "With the state" : "Next";
  }
}

/** Steps for a filing, or null when a tracker doesn't apply (cancelled or refunded). */
export function filingSteps(
  f: TrackerInput,
  dates: Partial<Record<TrackerKey, string | null>> = {},
): TrackerStep[] | null {
  const s = f.status;
  if (s === "cancelled" || s === "refunded") return null;
  const ordered = s !== "draft";
  const paymentRetry = s === "draft" && (f.orderStatus === "payment_failed" || f.orderStatus === "expired");

  const known: Record<TrackerKey, { state: StepState; caption: string | null } | null> = {
    details:
      s === "needs_information" && !f.isComplete
        ? { state: "attention", caption: "Details needed" }
        : f.isComplete || (ordered && s !== "needs_information")
          ? { state: "done", caption: dayOf(dates.details) }
          : null,
    authorized:
      s === "needs_information" && f.isComplete
        ? { state: "attention", caption: "Sign again" }
        : f.authorized
          ? { state: "done", caption: dayOf(dates.authorized) }
          : null,
    paid: ordered || PAID_ORDER_STATUSES.has(f.orderStatus ?? "")
      ? { state: "done", caption: dayOf(dates.paid) }
      : paymentRetry && f.isComplete && f.authorized
        ? { state: "attention", caption: "Try again" }
        : null,
    submitted: ["submitted", "accepted", "completed", "rejected"].includes(s)
      ? { state: "done", caption: dayOf(dates.submitted) }
      : s === "needs_customer_action"
        ? { state: "attention", caption: "Waiting on you" }
        : null,
    accepted:
      s === "rejected"
        ? { state: "problem", caption: "Not accepted" }
        : s === "accepted" || s === "completed"
          ? { state: "done", caption: dayOf(dates.accepted) }
          : null,
  };

  const keys: TrackerKey[] = ["details", "authorized", "paid", "submitted", "accepted"];
  const flagged = keys.some((k) => known[k] && known[k]!.state !== "done");
  let currentAssigned = flagged;
  return keys.map((key) => {
    const k = known[key];
    if (k) return { key, label: LABELS[key], state: k.state, caption: k.caption };
    if (!currentAssigned) {
      currentAssigned = true;
      return { key, label: LABELS[key], state: "current" as const, caption: currentCaption(key, f) };
    }
    return { key, label: LABELS[key], state: "upcoming" as const, caption: null };
  });
}

const STATE_TEXT: Record<StepState, string> = {
  done: "done",
  current: "current step",
  attention: "needs your attention",
  problem: "not accepted",
  upcoming: "not yet",
};

/**
 * Horizontal step tracker. `full` draws numbered nodes with captions (filing and
 * business pages); `compact` is a segmented bar for business cards.
 */
export function FilingTracker({
  filing,
  dates,
  variant = "full",
  className,
}: {
  filing: TrackerInput;
  dates?: Partial<Record<TrackerKey, string | null>>;
  variant?: "full" | "compact";
  className?: string;
}) {
  const steps = filingSteps(filing, dates);
  if (!steps) return null;

  if (variant === "compact") {
    const done = steps.filter((s) => s.state === "done").length;
    return (
      <div className={cn("grid gap-2", className)}>
        <p className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="font-semibold text-fg">Filing progress</span>
          <span className="tnum text-muted">
            {done} of {steps.length} steps done
          </span>
        </p>
        <ol aria-label="Filing progress" className="grid grid-cols-5 gap-1.5">
          {steps.map((step) => (
            <li key={step.key} className="grid min-w-0 gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full",
                  step.state === "done"
                    ? "bg-accent"
                    : step.state === "current"
                      ? "bg-highlight"
                      : step.state === "attention"
                        ? "bg-highlight-strong"
                        : step.state === "problem"
                          ? "bg-danger"
                          : "bg-surface-3",
                )}
              />
              <span
                className={cn(
                  "truncate text-[11px] leading-tight sm:text-xs",
                  step.state === "upcoming" ? "text-subtle" : "font-semibold text-fg",
                )}
              >
                {step.label}
                <span className="sr-only">: {STATE_TEXT[step.state]}{step.caption ? `, ${step.caption}` : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <ol aria-label="Filing progress" className={cn("grid grid-cols-5", className)}>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="relative grid min-w-0 content-start justify-items-center gap-2 px-0.5 text-center">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-1/2 top-[15px] h-0.5 w-full sm:top-[17px]",
                  step.state === "done" ? "bg-accent" : "border-t-2 border-dashed border-border-strong",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full sm:size-9",
                step.state === "done" && "bg-accent text-accent-fg",
                step.state === "current" && "border-2 border-accent bg-surface ring-4 ring-accent/15",
                step.state === "attention" && "bg-highlight text-highlight-fg ring-4 ring-highlight/25",
                step.state === "problem" && "border-2 border-danger/40 bg-danger-soft text-danger",
                step.state === "upcoming" && "border-2 border-border-strong bg-surface",
              )}
            >
              {step.state === "done" ? <Check size={16} weight="bold" /> : null}
              {step.state === "current" ? <span className="size-2.5 rounded-full bg-accent" /> : null}
              {step.state === "attention" ? <ExclamationMark size={16} weight="bold" /> : null}
              {step.state === "problem" ? <X size={15} weight="bold" /> : null}
            </span>
            <span
              className={cn(
                "max-w-full text-[11px] font-semibold leading-tight min-[400px]:text-xs sm:text-sm",
                step.state === "upcoming" ? "text-subtle" : "text-fg",
              )}
            >
              {step.label}
              <span className="sr-only">: {STATE_TEXT[step.state]}</span>
            </span>
            {step.caption ? (
              <span
                className={cn(
                  "tnum -mt-1 max-w-full text-[11px] leading-snug sm:text-[13px]",
                  step.state === "attention" || step.state === "problem" ? "font-semibold text-fg" : "text-muted",
                )}
              >
                {step.caption}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
