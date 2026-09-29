import { ArrowLeft, ArrowRight, BellSimpleRinging, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import { formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import { deadlineLabel } from "@/lib/domain/deadline-copy";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { periodFor } from "@/lib/filings/customer";
import { readPendingLookup } from "@/lib/lookup/pending";
import { readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";
import { ActionForm } from "@/components/funnel/action-form";
import { entityPhrase } from "@/components/funnel/entity-noun";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";
import { DateTile } from "@/components/visual/date-tile";
import { confirmStart } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your business",
  robots: { index: false, follow: false },
};

const editLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted underline decoration-border-strong underline-offset-4 hover:text-fg hover:decoration-fg";

export default async function FileStartPage({ searchParams }: PageProps<"/file/start">) {
  await requireUser("/file/start");
  const sp = await searchParams;
  const lookup = await readPendingLookup();
  if (!lookup) redirect("/find?missing=1");

  const homeJurisdiction = lookup.isForeign ? await readLookupHomeJurisdiction() : null;
  const jurisdiction = getJurisdiction(lookup.stateCode);
  const stateName = jurisdiction?.name ?? lookup.stateCode;
  const agencyName = jurisdiction?.agency.name.split(" - ")[0] ?? `${stateName} state agency`;
  const rule = findRule(lookup.stateCode, lookup.entityType, "annual_report", lookup.isForeign);
  const supported = Boolean(rule && rule.verificationStatus === "verified" && isRuleSellable(rule));

  let period: FilingPeriod | null = null;
  if (rule) {
    try {
      period = periodFor(rule, { formationDate: lookup.formationDate, alreadyFiledThisYear: lookup.alreadyFiledThisYear });
    } catch {
      period = null;
    }
  }
  const currentYear = Number(todayInTimeZone(jurisdiction?.timezone ?? "America/New_York").slice(0, 4));
  const nothingDueYet = period !== null && period.periodYear > currentYear;
  const track = sp.mode === "track" || nothingDueYet;

  return (
    <Container className="max-w-3xl pt-8 sm:pt-12">
      {!track && supported ? <FunnelSteps current="details" className="mb-10" /> : null}

      <div className="grid gap-3">
        {track ? (
          <span className="grid size-12 place-items-center rounded-full bg-highlight-soft text-highlight-fg" aria-hidden>
            <BellSimpleRinging size={24} weight="fill" />
          </span>
        ) : null}
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">
          {track ? "Add your business for reminders" : "Confirm your business"}
        </h1>
        <p className="max-w-[58ch] text-[16px] leading-relaxed text-muted">
          {track
            ? "We'll add it to your account and email you before the report is due. There's nothing to pay now."
            : `We'll add it to your account and start your ${stateName} ${rule?.filingName.toLowerCase() ?? "annual report"}. Next, you'll confirm the details the state asks for.`}
        </p>
      </div>

      {!supported ? (
        <div role="alert" className="mt-8 flex gap-3 rounded-[var(--radius-surface)] border border-warning/30 bg-warning-soft p-5">
          <WarningCircle size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <div className="grid gap-1.5 text-[15px]">
            <p className="font-semibold text-fg">We can&apos;t file this one yet</p>
            <p className="text-muted">We don&apos;t have verified filing rules for {entityPhrase(stateName, lookup.entityType)}.</p>
            <p className="mt-1">
              <Link href="/find" className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                Check a different business
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-7 sm:pt-7">
            <div className="grid min-w-0 gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-fg">
                  {lookup.stateCode}
                </span>
                {stateName} · {ENTITY_TYPE_LABELS[lookup.entityType]}
              </p>
              <h2 className="font-display text-[24px] font-semibold leading-tight text-fg [overflow-wrap:anywhere] sm:text-[28px]">
                {lookup.legalName}
              </h2>
            </div>
            <Link href="/find" className={editLinkClass}>
              <ArrowLeft size={16} aria-hidden />
              Edit details
            </Link>
          </div>

          {period ? (
            <div className="mx-5 mt-5 flex items-center gap-4 rounded-[var(--radius-control)] bg-surface-2 p-3.5 sm:mx-7">
              <DateTile date={period.dueDate} size="sm" />
              {period.phase === "first_report_later" ? (
                <p className="text-[15px] leading-6 text-fg">
                  <span className="font-semibold">No report due this year.</span>{" "}
                  <span className="text-muted">The first one is due by {formatLongDate(period.dueDate)}.</span>
                </p>
              ) : (
                <p className="grid text-[15px] leading-6">
                  <span className="font-semibold text-fg">
                    {period.periodYear} report due {formatLongDate(period.dueDate)}
                  </span>
                  <span
                    className={cn(
                      "tnum",
                      period.phase === "overdue" ? "font-medium text-warning" : "text-muted",
                    )}
                  >
                    {deadlineLabel(period.daysRemaining, period.dueDate)}
                  </span>
                </p>
              )}
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-7">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-3 text-[15px]">
              {[
                { term: "Formation date", value: lookup.formationDate ? formatLongDate(lookup.formationDate) : "Not entered" },
                { term: "State entity number", value: lookup.entityNumber ?? "Not entered" },
                ...(lookup.isForeign ? [{ term: "Formed in", value: homeJurisdiction ?? "Outside " + stateName }] : []),
                ...(lookup.isNonprofit ? [{ term: "Not-for-profit purpose", value: "Yes" }] : []),
              ].map((row) => (
                <div key={row.term} className="contents">
                  <dt className="text-muted">{row.term}</dt>
                  <dd className="text-right font-medium text-fg [overflow-wrap:anywhere]">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="grid gap-4 border-t border-border bg-surface-2/50 px-5 py-5 sm:flex sm:items-center sm:justify-between sm:px-7">
            <p className="max-w-[36ch] text-sm leading-6 text-muted">
              {track
                ? "Filed it yourself later? Tell us and the reminders stop."
                : "Nothing is charged until checkout, where you'll see the state fee and ours as separate lines."}
            </p>
            <ActionForm
              action={confirmStart}
              hidden={{ mode: track ? "track" : "file" }}
              className="grid gap-4 sm:min-w-[16rem]"
              label={
                <>
                  {track ? "Save and get reminders" : "Continue to details"}
                  <ArrowRight size={18} weight="bold" aria-hidden />
                </>
              }
              pendingLabel={track ? "Adding…" : "Starting…"}
            />
          </div>
        </div>
      )}

      <p className="mt-6 max-w-[64ch] text-sm leading-6 text-subtle">
        You can also file directly with the {agencyName} for the state fee alone.
      </p>

      {!supported ? (
        <div className="mt-6">
          <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
            Go to your dashboard
          </Link>
        </div>
      ) : null}
    </Container>
  );
}
