import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { Badge, FilingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/surface";
import type { BusinessView, FilingSummary, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { DaysRemaining, DueDate } from "./due-info";
import { standingText } from "./format";
import { FileDirectlyNote, RequirementActions } from "./requirement-actions";
import { businessHref, filingHref } from "./steps";

export function businessMeta(business: BusinessView): string {
  const parts = [business.stateName, ENTITY_TYPE_LABELS[business.entityType]];
  if (business.isForeign) parts.push("Foreign");
  return parts.join(" · ");
}

/** Filing status + payment status pair, labelled for screen readers and sighted users. */
export function StatusPair({ filing }: { filing: FilingSummary | null }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
      <div className="flex items-center gap-2">
        <dt>Filing</dt>
        <dd>{filing ? <FilingStatusBadge status={filing.status} /> : <Badge>Not ordered</Badge>}</dd>
      </div>
      <div className="flex items-center gap-2">
        <dt>Payment</dt>
        <dd>
          <PaymentStatusBadge status={filing?.orderStatus ?? null} />
        </dd>
      </div>
    </dl>
  );
}

/**
 * One business on the dashboard: who it is, what's due next, where the filing
 * stands, and the one action that moves it forward.
 */
export function BusinessRow({
  business,
  nextRequirement,
  latestFiling,
}: {
  business: BusinessView;
  nextRequirement: RequirementView | null;
  latestFiling: FilingSummary | null;
}) {
  const headingId = `business-${business.id}`;
  return (
    <Card className="overflow-hidden">
      <article aria-labelledby={headingId}>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(12rem,auto)] lg:gap-8">
          <div className="grid content-start gap-1.5">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight text-fg">
              <Link
                href={businessHref(business.id)}
                className="group inline-flex items-center gap-1 rounded-[var(--radius-control)] hover:text-accent"
              >
                <span className="break-words">{business.legalName}</span>
                <CaretRight size={16} weight="bold" className="shrink-0 text-subtle group-hover:text-accent" aria-hidden />
              </Link>
            </h2>
            <p className="text-sm text-muted">{businessMeta(business)}</p>
            <p className="text-sm text-subtle">{standingText(business.standing, business.standingSource)}</p>
          </div>

          <div className="grid content-start gap-2.5">
            {nextRequirement ? (
              <>
                <div className="grid gap-0.5">
                  <p className="text-sm text-muted">Next filing</p>
                  <p className="font-medium text-fg">
                    {nextRequirement.periodYear} {nextRequirement.filingName}
                  </p>
                  <p className="text-[15px] text-fg">
                    Due <DueDate value={nextRequirement.dueDate} />
                    <span aria-hidden className="mx-1.5 text-subtle">
                      ·
                    </span>
                    <DaysRemaining requirement={nextRequirement} />
                  </p>
                </div>
                <StatusPair filing={nextRequirement.activeFiling} />
              </>
            ) : (
              <div className="grid gap-1">
                <p className="text-sm text-muted">Next filing</p>
                <p className="font-medium text-fg">Nothing open right now</p>
                <p className="text-sm text-muted">
                  {business.rule
                    ? "We'll add the next report and remind you before it's due."
                    : "We don't track filings for this state and entity type yet."}
                </p>
                {latestFiling ? (
                  <Link
                    href={filingHref(latestFiling.id)}
                    className="mt-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg sm:min-h-0"
                  >
                    View your {latestFiling.periodYear} filing
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid content-start lg:justify-items-end">
            {nextRequirement ? (
              <RequirementActions business={business} requirement={nextRequirement} returnTo="/dashboard" className="lg:justify-items-end" />
            ) : null}
          </div>
        </div>
        {nextRequirement &&
        nextRequirement.status === "open" &&
        (!nextRequirement.activeFiling || nextRequirement.activeFiling.status === "draft") &&
        business.rule ? (
          <div className="border-t border-border bg-surface-2/50 px-5 py-3 sm:px-6">
            <FileDirectlyNote business={business} />
          </div>
        ) : null}
      </article>
    </Card>
  );
}
