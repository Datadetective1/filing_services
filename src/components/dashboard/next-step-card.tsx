import Link from "next/link";
import { ArrowRight, CalendarBlank, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import type { FilingStatus } from "@/lib/domain/filing-status";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { DocumentSheet } from "@/components/visual/document-tile";
import { deadlineRingLabel } from "./due-info";
import { FilingTracker, type TrackerKey } from "./filing-tracker";
import { FILE_STEPS, nextCustomerStep, type StepInput } from "./steps";

interface Waiting {
  title: string;
  body: string;
  tone: "neutral" | "success" | "warning";
}

function waitingCopy(status: FilingStatus, hasDocuments: boolean): Waiting | null {
  switch (status) {
    case "ready_for_review":
      return { tone: "neutral", title: "Nothing needed from you right now", body: "We're reviewing your information before filing. We'll email you if anything needs your attention." };
    case "ready_to_file":
    case "in_progress":
      return { tone: "neutral", title: "Nothing needed from you right now", body: "Your filing is prepared and on its way to the state. We'll email you when it's submitted." };
    case "submitted":
      return { tone: "neutral", title: "Waiting on the state", body: "Your filing is with the state. We'll let you know as soon as it's accepted." };
    case "accepted":
      return { tone: "success", title: "Accepted by the state", body: hasDocuments ? "Your documents are below." : "We'll add the state's receipt below as soon as we have it." };
    case "completed":
      return { tone: "success", title: "All done", body: hasDocuments ? "Your filed report and receipt are below. Keep them with your business records." : "This filing is complete." };
    case "rejected":
      return { tone: "warning", title: "The state didn't accept this filing", body: "We're looking into it and will contact you with next steps." };
    default:
      return null;
  }
}

const toneStyles = {
  action: "border-highlight/60 bg-highlight-soft",
  neutral: "border-border bg-surface",
  success: "border-accent/20 bg-accent-soft",
  warning: "border-warning/30 bg-warning-soft",
} as const;

const eyebrowStyles = {
  action: "text-highlight-fg",
  neutral: "text-muted",
  success: "text-accent-soft-fg",
  warning: "text-warning",
} as const;

/**
 * "What happens next" for a filing: one clear action (with the deadline as a
 * countdown) or a calm status note, above the filing's step tracker.
 */
export function NextStepCard({
  filing,
  hasDocuments,
  daysLeft,
  dueDate,
  trackerDates,
  className,
}: {
  filing: StepInput;
  hasDocuments: boolean;
  /** Days until the due date while the customer still has something to do, else null. */
  daysLeft?: number | null;
  dueDate?: string | null;
  trackerDates?: Partial<Record<TrackerKey, string | null>>;
  className?: string;
}) {
  const step = nextCustomerStep(filing);
  const hasAction = step.kind !== "none" && Boolean(step.href);
  const waiting = hasAction ? null : waitingCopy(filing.status, hasDocuments);
  if (!hasAction && !waiting) return null;

  const tone = hasAction ? "action" : waiting!.tone;
  const title = hasAction ? step.title : waiting!.title;
  const body = hasAction ? step.body : waiting!.body;
  const Icon = tone === "success" ? CheckCircle : tone === "warning" ? WarningCircle : Clock;
  const ring = hasAction && typeof daysLeft === "number" && dueDate ? { days: daysLeft, due: dueDate } : null;

  return (
    <section
      aria-labelledby="next-step-title"
      className={cn("overflow-hidden rounded-[var(--radius-surface)] border shadow-card", toneStyles[tone], className)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 p-5 sm:gap-x-8 sm:p-7">
        <div className="grid min-w-0 content-start gap-2">
          <p className={cn("text-sm font-semibold", eyebrowStyles[tone])}>
            {hasAction ? "What do I need to do next?" : "Where it stands"}
          </p>
          <h2 id="next-step-title" className="flex items-start gap-2.5 text-[24px] font-semibold leading-[1.15] text-fg sm:text-[30px]">
            {!hasAction ? (
              <Icon
                size={28}
                weight={tone === "success" ? "fill" : "regular"}
                aria-hidden
                className={cn(
                  "mt-0.5 shrink-0",
                  tone === "success" ? "text-accent" : tone === "warning" ? "text-warning" : "text-muted",
                )}
              />
            ) : null}
            {title}
          </h2>
        </div>
        <div className="col-start-2 row-start-1 sm:row-span-3">
          {ring ? (
            <CountdownRing days={ring.days} size={84} className="mt-1 rounded-full bg-surface/70" label={deadlineRingLabel(ring.days, ring.due)} />
          ) : tone === "success" && hasDocuments ? (
            <DocumentSheet title="Filed report" stamp="Filed" size="sm" className="mt-1 rotate-[4deg] max-sm:hidden" />
          ) : null}
        </div>
        <div className="col-span-2 mt-3 grid content-start gap-2 sm:col-span-1">
          <p className="max-w-[58ch] text-base leading-7 text-muted">{body}</p>
          {ring ? (
            <p className="flex items-center gap-1.5 text-[15px] text-fg">
              <CalendarBlank size={17} aria-hidden className="shrink-0 text-highlight-fg" />
              <span>
                Due <time dateTime={ring.due} className="tnum">{formatLongDate(ring.due)}</time>
                <span aria-hidden className="mx-1.5 text-subtle">
                  ·
                </span>
                <span className={cn("tnum font-semibold", ring.days < 0 ? "text-warning" : "text-fg")}>
                  {describeDaysRemaining(ring.days)}
                </span>
              </span>
            </p>
          ) : null}
        </div>
        {hasAction && step.href ? (
          <div className="col-span-2 mt-5 flex flex-col gap-2 sm:col-span-1 sm:flex-row sm:items-center sm:gap-5">
            <ButtonLink href={step.href} size="lg" className="w-full sm:w-auto">
              {step.cta}
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            {step.kind === "reply" ? (
              <Link
                href={FILE_STEPS.details(filing.id)}
                className="inline-flex min-h-11 items-center justify-center font-semibold text-fg underline decoration-highlight-strong/60 decoration-2 underline-offset-4 hover:decoration-fg"
              >
                Update your details
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <FilingTrackerBand filing={filing} dates={trackerDates} />
    </section>
  );
}

function FilingTrackerBand({ filing, dates }: { filing: StepInput; dates?: Partial<Record<TrackerKey, string | null>> }) {
  if (filing.status === "cancelled" || filing.status === "refunded") return null;
  return (
    <div className="border-t border-fg/[0.07] bg-surface px-3 py-5 sm:px-7 sm:py-6">
      <FilingTracker filing={filing} dates={dates} />
    </div>
  );
}
