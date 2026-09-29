import { CountdownRing } from "@/components/visual/countdown-ring";
import type { BusinessView, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { StatusPair } from "./business-row";
import { DateChip, DaysRemaining, deadlineRingLabel, DueDate, isHandledByUs } from "./due-info";
import { FilingTracker } from "./filing-tracker";
import { FileDirectlyNote, RequirementActions } from "./requirement-actions";

/**
 * An open filing period on the business page: the countdown to its deadline, where
 * the filing stands, and what to do about it.
 */
export function OpenRequirement({
  business,
  requirement,
  returnTo,
}: {
  business: BusinessView;
  requirement: RequirementView;
  returnTo: `/dashboard/businesses/${string}`;
}) {
  const active = requirement.activeFiling;
  const handled = isHandledByUs(requirement);
  const offerFileDirect = business.rule && (!active || active.status === "draft");

  return (
    <article
      aria-labelledby={`req-${requirement.id}`}
      className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-5 p-5 sm:p-7 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-7">
        {handled ? (
          <DateChip value={requirement.dueDate} />
        ) : (
          <CountdownRing days={requirement.daysRemaining} size={88} label={deadlineRingLabel(requirement.daysRemaining, requirement.dueDate)} />
        )}
        <div className="grid min-w-0 gap-1.5">
          <h3 id={`req-${requirement.id}`} className="text-xl font-semibold leading-snug text-fg sm:text-2xl">
            {requirement.periodYear} {business.stateName} {requirement.filingName}
          </h3>
          <p className="text-[15px] text-fg">
            Due <DueDate value={requirement.dueDate} />
            <span aria-hidden className="mx-1.5 text-subtle">
              ·
            </span>
            <DaysRemaining requirement={requirement} />
          </p>
          <div className="mt-1">
            <StatusPair filing={active} />
          </div>
        </div>
        <RequirementActions
          business={business}
          requirement={requirement}
          returnTo={returnTo}
          className="col-span-2 content-start md:col-span-1 md:max-w-[20rem] md:justify-items-end md:self-start"
        />
      </div>
      {active ? (
        <div className="border-t border-border px-4 py-5 sm:px-7 sm:py-6">
          <FilingTracker filing={active} />
        </div>
      ) : null}
      {offerFileDirect ? (
        <footer className="border-t border-border bg-surface-2/60 px-5 py-3 sm:px-7">
          <FileDirectlyNote business={business} />
        </footer>
      ) : null}
    </article>
  );
}
