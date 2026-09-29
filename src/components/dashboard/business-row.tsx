import Link from "next/link";
import { CaretRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { Badge, FilingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { DocumentSheet } from "@/components/visual/document-tile";
import type { BusinessView, FilingSummary, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { BusinessMark } from "./business-mark";
import { DateChip, DaysRemaining, DueDate, isHandledByUs } from "./due-info";
import { FilingTracker } from "./filing-tracker";
import { FileDirectlyNote, RequirementActions } from "./requirement-actions";
import { businessStanding, requirementAction } from "./requirement-state";
import { quietLinkClass } from "./section";
import { businessHref, filingHref } from "./steps";

export function businessMeta(business: BusinessView): string {
  const parts = [business.stateName, ENTITY_TYPE_LABELS[business.entityType]];
  if (business.isForeign) parts.push("Foreign");
  return parts.join(" · ");
}

/** Filing status and payment status, as the pair of badges a filing carries. */
export function StatusPair({ filing }: { filing: FilingSummary | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filing ? <FilingStatusBadge status={filing.status} /> : <Badge>Not ordered</Badge>}
      {filing?.orderStatus ? <PaymentStatusBadge status={filing.orderStatus} /> : null}
    </div>
  );
}

/**
 * One business on the dashboard, drawn as an object: its mark and name, the next
 * deadline as a calendar leaf, where the filing stands, and the one action that
 * moves it forward.
 */
export function BusinessRow({
  business,
  nextRequirement,
  latestFiling,
  headingLevel = "h3",
}: {
  business: BusinessView;
  nextRequirement: RequirementView | null;
  latestFiling: FilingSummary | null;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const headingId = `business-${business.id}`;
  const action = nextRequirement ? requirementAction(business, nextRequirement) : null;
  const active = nextRequirement?.activeFiling ?? null;
  const standing = businessStanding(nextRequirement, action, latestFiling);
  const pastFiling = latestFiling && latestFiling.id !== active?.id ? latestFiling : null;
  const late = nextRequirement ? nextRequirement.daysRemaining < 0 && !isHandledByUs(nextRequirement) : false;
  // Shown where we offer to file now; the business page always carries it.
  const offerFileDirect =
    nextRequirement &&
    nextRequirement.status === "open" &&
    (!active || active.status === "draft") &&
    (action?.kind === "start" || action?.kind === "continue") &&
    business.rule;

  return (
    <article
      aria-labelledby={headingId}
      className="@container overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.04)] transition-shadow duration-200 hover:shadow-card"
    >
      <div className="grid gap-5 p-5 sm:p-6">
        <header className="flex items-center gap-4">
          <BusinessMark id={business.id} name={business.legalName} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <Heading id={headingId} className="text-lg font-semibold leading-snug text-fg sm:text-xl">
              <Link
                href={businessHref(business.id)}
                className="group inline-flex items-center gap-1 rounded-[6px] transition-colors hover:text-accent"
              >
                <span className="break-words">{business.legalName}</span>
                <CaretRight
                  size={16}
                  weight="bold"
                  className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  aria-hidden
                />
              </Link>
            </Heading>
            <p className="text-sm text-muted">{businessMeta(business)}</p>
          </div>
        </header>

        {nextRequirement ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)_auto] @2xl:gap-x-5">
            <DateChip value={nextRequirement.dueDate} tone={late ? "late" : "default"} className="self-start" />
            <div className="grid min-w-0 content-center gap-1">
              <p className="font-semibold text-fg">
                {nextRequirement.periodYear} {nextRequirement.filingName}
              </p>
              <p className="text-[15px] text-fg">
                Due <DueDate value={nextRequirement.dueDate} />
                <span aria-hidden className="mx-1.5 text-subtle">
                  ·
                </span>
                <DaysRemaining requirement={nextRequirement} />
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {active ? (
                  <>
                    <FilingStatusBadge status={active.status} />
                    {active.orderStatus ? <PaymentStatusBadge status={active.orderStatus} /> : null}
                  </>
                ) : (
                  <Badge tone={standing.tone}>{standing.label}</Badge>
                )}
              </div>
            </div>
            <RequirementActions
              business={business}
              requirement={nextRequirement}
              returnTo="/dashboard"
              className="col-span-2 content-start @2xl:col-span-1 @2xl:max-w-[19rem] @2xl:justify-items-end"
            />
            {active ? (
              <FilingTracker
                filing={active}
                variant="compact"
                className="col-span-2 border-t border-border pt-4 @2xl:col-start-2"
              />
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 p-4">
            <CheckCircle size={20} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <div className="grid gap-0.5">
              <p className="font-semibold text-fg">Nothing open right now</p>
              <p className="text-sm leading-6 text-muted">
                {business.rule
                  ? "We'll add the next report and remind you before it's due."
                  : "We don't track filings for this state and entity type yet."}
              </p>
            </div>
          </div>
        )}

        {pastFiling ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
            <DocumentSheet title={`${pastFiling.periodYear} ${pastFiling.filingName}`} size="xs" />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="text-[13px] text-muted">
                {pastFiling.periodYear} {pastFiling.filingName}
              </p>
              <div>
                <FilingStatusBadge status={pastFiling.status} />
              </div>
            </div>
            <Link href={filingHref(pastFiling.id)} className={`${quietLinkClass} text-sm`}>
              View filing
              <span className="sr-only"> for {pastFiling.periodYear}</span>
            </Link>
          </div>
        ) : null}
      </div>

      {offerFileDirect ? (
        <footer className="border-t border-border bg-surface-2/60 px-5 py-3 sm:px-6">
          <FileDirectlyNote business={business} />
        </footer>
      ) : null}
    </article>
  );
}
