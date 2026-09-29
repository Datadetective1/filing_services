import Link from "next/link";
import { CalendarBlank, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { formatLongDate, parseISODate } from "@/lib/domain/dates";
import { FILED_STATUSES } from "@/lib/domain/filing-status";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { DaysRemaining, deadlineRingLabel, DueDate } from "./due-info";
import { FileDirectlyNote, RequirementActions } from "./requirement-actions";
import type { FocusItem } from "./requirement-state";
import { businessHref } from "./steps";

const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

function byMonthDay(iso: string): string {
  const { year, month, day } = parseISODate(iso);
  return monthDay.format(new Date(Date.UTC(year, month - 1, day)));
}

function copyFor(item: FocusItem): { title: string; body: string } {
  const { action, requirement } = item;
  const filing = `${requirement.periodYear} ${requirement.filingName.toLowerCase()}`;
  if (action.kind === "continue") return { title: action.step.title, body: action.step.body };
  if (action.kind === "start") {
    return {
      title: requirement.daysRemaining < 0 ? `The ${filing} is past due` : `File the ${filing} by ${byMonthDay(requirement.dueDate)}`,
      body: "Have us file it, or file it yourself with the state. Already done? Tell us and the reminders stop.",
    };
  }
  return {
    title: `File the ${filing} with the state`,
    body: "We can't file this one for you yet. You can file it directly with the state, then tell us here so the reminders stop.",
  };
}

/**
 * The top of the dashboard: the single most useful next move across all
 * businesses, in plain words, with its deadline as a countdown.
 */
export function NextActionPanel({
  focus,
  others,
  upcoming,
}: {
  focus: FocusItem | null;
  others: FocusItem[];
  upcoming: FocusItem | null;
}) {
  if (!focus) return <CaughtUpPanel upcoming={upcoming} />;
  const { business, requirement } = focus;
  const { title, body } = copyFor(focus);

  return (
    <section
      aria-labelledby="next-step-title"
      className="rounded-[var(--radius-surface)] border border-highlight/60 bg-highlight-soft p-5 shadow-card sm:p-7"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 sm:gap-x-8">
        <div className="grid min-w-0 content-start gap-2">
          <p className="text-sm font-semibold text-highlight-fg">What do I need to do next?</p>
          <h2 id="next-step-title" className="text-[26px] font-semibold leading-[1.1] text-fg sm:text-[34px]">
            {title}
          </h2>
        </div>
        <div className="col-start-2 row-start-1 sm:row-span-2">
          <CountdownRing
            days={requirement.daysRemaining}
            size={84}
            className="mt-1 rounded-full bg-surface/70"
            label={deadlineRingLabel(requirement.daysRemaining, requirement.dueDate)}
          />
        </div>
        <div className="col-span-2 mt-3 grid content-start gap-3 sm:col-span-1">
          <p className="max-w-[56ch] text-base leading-7 text-muted">{body}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-fg">
            <Link
              href={businessHref(business.id)}
              className="break-words font-semibold underline decoration-highlight-strong/60 decoration-2 underline-offset-4 hover:decoration-fg"
            >
              {business.legalName}
            </Link>
            <span className="inline-flex items-start gap-1.5">
              <CalendarBlank size={17} aria-hidden className="mt-[3px] shrink-0 text-highlight-fg" />
              <span>
                {requirement.periodYear} {business.stateName} {requirement.filingName.toLowerCase()} due{" "}
                <DueDate value={requirement.dueDate} />
                <span aria-hidden className="mx-1.5 text-subtle">
                  ·
                </span>
                <DaysRemaining requirement={requirement} />
              </span>
            </span>
          </div>
        </div>
      </div>

      <RequirementActions
        business={business}
        requirement={requirement}
        returnTo="/dashboard"
        size="panel"
        className="mt-5 border-t border-highlight/50 pt-5"
      />
      {business.rule && (!requirement.activeFiling || requirement.activeFiling.status === "draft") ? (
        <FileDirectlyNote business={business} className="mt-2" />
      ) : null}

      {others.length > 0 ? (
        <p className="mt-3 text-sm text-muted">
          {others.length === 1 ? "One more filing needs you too." : `${others.length} more filings need you too.`}{" "}
          <a href="#businesses" className="font-semibold text-fg underline decoration-highlight-strong/60 decoration-2 underline-offset-4">
            See your businesses
          </a>
        </p>
      ) : null}
    </section>
  );
}

function CaughtUpPanel({ upcoming }: { upcoming: FocusItem | null }) {
  let body = "Nothing is due for your businesses right now. When a new filing period opens, it will show up here.";
  let showRing = false;
  if (upcoming) {
    const { action, business, requirement } = upcoming;
    const filing = `${requirement.periodYear} ${requirement.filingName.toLowerCase()}`;
    if (action.kind === "view") {
      body = FILED_STATUSES.includes(action.filing.status)
        ? `The ${filing} for ${business.legalName} is with the state. We'll email you when there's news.`
        : `We're handling the ${filing} for ${business.legalName}. We'll email you if we need anything.`;
    } else if (action.kind === "opens_later") {
      showRing = true;
      body = `Next up is the ${filing} for ${business.legalName}, due ${formatLongDate(requirement.dueDate)}. Filing opens ${formatLongDate(action.opensOn)}, and we'll remind you before it's due.`;
    } else {
      showRing = true;
      body = `Next up is the ${filing} for ${business.legalName}, due ${formatLongDate(requirement.dueDate)}.`;
    }
  }

  return (
    <section
      aria-labelledby="next-step-title"
      className="flex items-start justify-between gap-5 rounded-[var(--radius-surface)] border border-accent/20 bg-accent-soft p-5 sm:gap-8 sm:p-7"
    >
      <div className="grid min-w-0 gap-2">
        <p className="text-sm font-semibold text-accent-soft-fg">What do I need to do next?</p>
        <h2 id="next-step-title" className="flex items-center gap-2 text-[26px] font-semibold leading-[1.1] text-fg sm:text-[34px]">
          <CheckCircle size={30} weight="fill" aria-hidden className="shrink-0 text-accent" />
          Nothing right now.
        </h2>
        <p className="max-w-[58ch] text-base leading-7 text-muted">{body}</p>
      </div>
      {upcoming && showRing ? (
        <CountdownRing
          days={upcoming.requirement.daysRemaining}
          size={84}
          className="mt-1 rounded-full bg-surface/70"
          label={deadlineRingLabel(upcoming.requirement.daysRemaining, upcoming.requirement.dueDate)}
        />
      ) : null}
    </section>
  );
}
