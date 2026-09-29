import { ArrowLeft, ArrowSquareOut, BellSimpleRinging, CaretDown, Info } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { site } from "@/config/site";
import { getCurrentUser } from "@/lib/auth/session";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { dueRuleText } from "@/lib/compliance/view";
import { describeDaysRemaining, formatLongDate, formatShortDate, todayInTimeZone } from "@/lib/domain/dates";
import { filingWindowOpensOn, isFilingWindowOpen, type FilingPeriod } from "@/lib/domain/deadlines";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { periodFor } from "@/lib/filings/customer";
import { readPendingLookup } from "@/lib/lookup/pending";
import { TrackView } from "@/components/analytics/track-view";
import { OfficialSource } from "@/components/compliance/official-source";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { entityPhrase } from "@/components/funnel/entity-noun";
import { TrackedLink } from "@/components/funnel/tracked-link";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Container, Facts } from "@/components/ui/surface";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { Receipt } from "@/components/visual/receipt";
import { readLookupHomeJurisdiction } from "../lookup-extras";

export const metadata: Metadata = {
  title: "Your filing requirement",
  robots: { index: false, follow: false },
};

function EditLink({ className }: { className?: string }) {
  return (
    <Link
      href="/find"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] text-sm font-medium text-muted underline decoration-border-strong underline-offset-4 hover:text-fg hover:decoration-fg",
        className,
      )}
    >
      <ArrowLeft size={16} aria-hidden />
      Edit details
    </Link>
  );
}

/** "PA · Pennsylvania · LLC" line above the answer. */
function Context({ stateCode, stateName, entityLabel }: { stateCode: string; stateName: string; entityLabel: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted">
      <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-fg">{stateCode}</span>
      {stateName} · {entityLabel}
    </p>
  );
}

/**
 * The answer itself: when it's due and how long is left, the state's fees and the
 * official source. Every value comes from the verified rule and today's date.
 */
function DeadlineCard({
  rule,
  period,
  agencyName,
  stateFeeCents,
  today,
  label,
}: {
  rule: ComplianceRuleDef;
  period: FilingPeriod;
  agencyName: string;
  stateFeeCents: number;
  today: string;
  label: ReactNode;
}) {
  const dueLong = formatLongDate(period.dueDate);
  const open = isFilingWindowOpen(rule, period.periodYear, period.dueDate, today);
  const opensOn = filingWindowOpensOn(rule, period.periodYear, period.dueDate);
  const overdue = period.phase === "overdue";
  const status = overdue
    ? { tone: "bg-warning", text: `${describeDaysRemaining(period.daysRemaining)}. It can still be filed.` }
    : open
      ? { tone: "bg-accent", text: "Filing window is open" }
      : { tone: "bg-highlight-strong", text: `Filing opens ${formatShortDate(opensOn)}` };
  const days = period.daysRemaining;

  return (
    <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
      <div className="flex items-center gap-4 p-5 sm:gap-6 sm:p-7">
        <CountdownRing
          days={days}
          size={84}
          label={`${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ${days < 0 ? "past" : "until"} the ${dueLong} due date`}
        />
        <div className="grid min-w-0 gap-1">
          <p className="text-sm font-semibold text-muted">{label}</p>
          <p className="tnum font-display text-[22px] font-semibold leading-tight text-fg sm:text-[30px]">
            {overdue ? "Was due" : "Due"} {dueLong}
          </p>
          <p className="mt-1 flex items-center gap-2 text-[14px] font-medium text-fg">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", status.tone)} />
            {status.text}
          </p>
        </div>
      </div>

      <dl className="tnum grid grid-cols-2 border-t border-border sm:grid-cols-3">
        <div className="grid content-start gap-1 border-r border-border px-5 py-4 sm:px-7">
          <dt className="text-sm text-muted">State fee</dt>
          <dd className="font-display text-2xl font-semibold text-fg">
            {stateFeeCents === 0 ? "None" : formatCents(stateFeeCents, { trimZeros: true })}
          </dd>
        </div>
        <div className="grid content-start gap-1 px-5 py-4 sm:border-r sm:border-border sm:px-7">
          <dt className="text-sm text-muted">State late fee</dt>
          <dd className="font-display text-2xl font-semibold text-fg">
            {rule.lateFeeCents ? formatCents(rule.lateFeeCents, { trimZeros: true }) : "None"}
          </dd>
        </div>
        <div className="grid content-start gap-1 px-5 py-4 max-sm:hidden sm:px-7">
          <dt className="text-sm text-muted">Due every year</dt>
          <dd className="text-[15px] font-semibold leading-6 text-fg">
            {dueRuleText(rule.dueRule).replace(/ each year$/, "")}
            {rule.formNumber ? <span className="block text-[13px] font-normal text-subtle">Form {rule.formNumber}</span> : null}
          </dd>
        </div>
      </dl>

      <details className="group border-t border-border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[15px] font-semibold text-fg hover:bg-surface-2/60 sm:px-7 [&::-webkit-details-marker]:hidden">
          What if it&apos;s filed late?
          <CaretDown size={16} weight="bold" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 px-5 pb-5 text-[15px] leading-6 text-muted sm:px-7">
          <p>{rule.lateFeeSummary}</p>
          <p>{rule.consequenceSummary}</p>
        </div>
      </details>

      <div className="border-t border-border bg-surface-2/60 px-5 py-3.5 sm:px-7">
        <OfficialSource href={rule.officialInfoUrl} agency={agencyName} lastVerifiedAt={rule.lastVerifiedAt} />
      </div>
    </div>
  );
}

export default async function FindResultPage() {
  const lookup = await readPendingLookup();
  if (!lookup) redirect("/find");

  const homeJurisdiction = lookup.isForeign ? await readLookupHomeJurisdiction() : null;
  const jurisdiction = getJurisdiction(lookup.stateCode);
  const stateName = jurisdiction?.name ?? lookup.stateCode;
  const agencyName = jurisdiction?.agency.name.split(" - ")[0] ?? `${stateName} state agency`;
  const entityLabel = ENTITY_TYPE_LABELS[lookup.entityType];
  const rule = findRule(lookup.stateCode, lookup.entityType, "annual_report", lookup.isForeign);
  const supported = Boolean(rule && rule.verificationStatus === "verified" && isRuleSellable(rule));

  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentUser());
  } catch {
    signedIn = false;
  }

  const entered = (
    <details className="group rounded-[var(--radius-surface)] border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-surface)] px-5 py-3 hover:bg-surface-2/60 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="grid gap-0.5">
          <span className="font-display text-[17px] font-semibold text-fg">Details you entered</span>
          <span className="text-sm text-muted [overflow-wrap:anywhere]">
            {lookup.legalName} · {stateName} {entityLabel}
          </span>
        </span>
        <CaretDown size={18} weight="bold" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-4 border-t border-border px-5 py-5 sm:px-6">
        <Facts
          items={[
            { term: "Legal name", value: <span className="[overflow-wrap:anywhere]">{lookup.legalName}</span> },
            { term: "State", value: stateName },
            { term: "Entity type", value: entityLabel },
            { term: "Formation date", value: lookup.formationDate ? formatLongDate(lookup.formationDate) : "Not entered" },
            { term: "State entity number", value: lookup.entityNumber ?? "Not entered" },
            {
              term: "Foreign entity",
              value: lookup.isForeign ? `Yes${homeJurisdiction ? `, formed in ${homeJurisdiction}` : ""}` : "No",
            },
            { term: "Not-for-profit purpose", value: lookup.isNonprofit ? "Yes" : "No" },
            { term: "This year's report", value: lookup.alreadyFiledThisYear ? "Already filed" : "Not filed yet" },
          ]}
        />
        <p className="flex gap-2 text-sm leading-6 text-muted">
          <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
          These are the details you typed. We haven&apos;t checked them against the state record.
        </p>
        <EditLink className="justify-self-start" />
      </div>
    </details>
  );

  if (!rule || !supported) {
    const searchUrl = lookup.stateCode === "PA" ? PENNSYLVANIA_FACTS.businessSearchUrl : jurisdiction?.agency.businessSearchUrl;
    return (
      <Container className="max-w-3xl pb-16 pt-6 sm:pb-24 sm:pt-10">
        <TrackView event="lookup_completed" stateCode={lookup.stateCode} entityType={lookup.entityType} />
        <EditLink />
        <div className="mt-4 grid gap-4">
          <Context stateCode={lookup.stateCode} stateName={stateName} entityLabel={entityLabel} />
          <h1 className="text-[32px] font-semibold leading-[1.06] tracking-[-0.03em] text-fg sm:text-[44px]">
            We can&apos;t help with this one yet
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-muted">
            We don&apos;t have verified filing rules for {entityPhrase(stateName, lookup.entityType)} yet, so we can&apos;t show a
            deadline or file it for you. The official agency is the best place to check what&apos;s required.
          </p>
        </div>

        {lookup.stateCode === "PA" ? (
          <div className="mt-8 flex gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg" aria-hidden>
              <Info size={20} weight="fill" />
            </span>
            <div className="grid min-w-0 gap-3">
              <p className="text-[15px] leading-7 text-fg">
                Based on the Pennsylvania Department of State&apos;s published requirements: {PENNSYLVANIA_FACTS.exemptTypes}
              </p>
              <OfficialSource
                href={PENNSYLVANIA_FACTS.exemptSource.url}
                agency="Pennsylvania Department of State"
                lastVerifiedAt={PENNSYLVANIA_FACTS.exemptSource.lastVerifiedAt}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {jurisdiction ? (
            <a href={jurisdiction.agency.websiteUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "lg")}>
              Visit the official agency site
              <ArrowSquareOut size={18} aria-hidden />
              <span className="sr-only">(opens a government website in a new tab)</span>
            </a>
          ) : null}
          {searchUrl ? (
            <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "lg")}>
              Official business search
              <ArrowSquareOut size={18} aria-hidden />
              <span className="sr-only">(opens a government website in a new tab)</span>
            </a>
          ) : null}
        </div>

        <div className="mt-12">{entered}</div>
        <p className="mt-8 text-sm leading-6 text-subtle">{site.disclaimer}</p>
      </Container>
    );
  }

  let period: FilingPeriod | null = null;
  try {
    period = periodFor(rule, { formationDate: lookup.formationDate, alreadyFiledThisYear: lookup.alreadyFiledThisYear });
  } catch {
    period = null;
  }
  const quote = await publicQuote(rule, { isNonprofit: lookup.isNonprofit });
  const today = todayInTimeZone(jurisdiction?.timezone ?? "America/New_York");
  const currentYear = Number(today.slice(0, 4));
  // Nothing can be filed yet when the report in view belongs to a future year (a new
  // business, or this year's report is already done): offer reminders instead.
  const reminderMode = period !== null && period.periodYear > currentYear;

  const startPath = reminderMode ? "/file/start?mode=track" : "/file/start";
  const signupHref = `/signup?next=${encodeURIComponent(startPath)}`;
  const stateFeeCents = quote?.governmentFeeCents ?? (lookup.isNonprofit && rule.nonprofitStateFeeCents === 0 ? 0 : rule.stateFeeCents);
  const filingHost = new URL(rule.officialFilingUrl).host;
  const filingLabel = period ? `${period.periodYear} ${rule.filingName.toLowerCase()}` : rule.filingName;

  const signInLine = !signedIn ? (
    <p className="text-center text-sm text-muted">
      Already have an account?{" "}
      <Link href={`/login?next=${encodeURIComponent(startPath)}`} className={textLinkClasses}>
        Sign in
      </Link>{" "}
      to continue.
    </p>
  ) : null;

  const aside = reminderMode ? (
    <div className="grid gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
          <BellSimpleRinging size={22} weight="fill" aria-hidden />
        </span>
        <p className="font-display text-xl font-semibold leading-tight text-fg">We&apos;ll remind you before it&apos;s due</p>
      </div>
      <p className="text-[15px] leading-6 text-muted">
        We email you 90, 60 and 30 days ahead, then closer to the date. There&apos;s nothing to pay now.
      </p>
      <form action={signedIn ? "/file/start" : "/signup"} method="get" className="grid">
        {signedIn ? <input type="hidden" name="mode" value="track" /> : <input type="hidden" name="next" value={startPath} />}
        <button type="submit" className={buttonClasses("primary", "lg", "w-full")}>
          <BellSimpleRinging size={18} weight="bold" aria-hidden />
          Get a reminder when it&apos;s due
        </button>
      </form>
      {signInLine}
      {quote ? (
        <details className="group border-t border-border pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
            What it costs if we file it later
            <CaretDown size={16} weight="bold" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <PriceBreakdown className="mt-3" quote={quote} stateName={stateName} totalLabel="Total if we file it" />
        </details>
      ) : null}
    </div>
  ) : (
    <>
      <Receipt
        title="If we file it for you"
        meta={`${stateName} ${ENTITY_TYPE_LABELS[rule.entityType]} ${rule.filingName}`}
        className="w-full"
      >
        {quote ? (
          <PriceBreakdown quote={quote} stateName={stateName} totalLabel="Total if we file it" />
        ) : (
          <p className="text-[15px] text-muted">Our service fee is shown as its own line before you pay.</p>
        )}
        <div className="mt-5 grid gap-3">
          <TrackedLink
            href={signedIn ? startPath : signupHref}
            event="filing_cta_clicked"
            stateCode={lookup.stateCode}
            entityType={lookup.entityType}
            className={buttonClasses("primary", "lg", "w-full")}
          >
            Have us file it
          </TrackedLink>
          {signInLine}
        </div>
      </Receipt>

      <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-lg font-semibold text-fg">Or do it yourself</p>
          <p className="tnum font-display text-2xl font-semibold text-fg">
            {stateFeeCents === 0 ? "No fee" : formatCents(stateFeeCents, { trimZeros: true })}
          </p>
        </div>
        <p className="text-sm leading-6 text-muted">
          File online at {filingHost} and pay only the state fee. Online filings there are approved automatically.
        </p>
        <a href={rule.officialFilingUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "md", "mt-1 w-full")}>
          File it yourself
          <ArrowSquareOut size={18} aria-hidden />
          <span className="sr-only">(opens the state&apos;s filing website in a new tab)</span>
        </a>
      </div>
    </>
  );

  return (
    <Container className="pb-16 pt-6 sm:pb-24 sm:pt-10">
      <TrackView event="lookup_completed" stateCode={lookup.stateCode} entityType={lookup.entityType} />
      <EditLink />

      <div className="mt-4 grid max-w-4xl gap-4">
        <Context stateCode={lookup.stateCode} stateName={stateName} entityLabel={entityLabel} />
        <h1 className="max-w-[24ch] text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-fg [overflow-wrap:anywhere] sm:text-[44px]">
          {reminderMode ? (
            "Nothing to file right now"
          ) : period ? (
            <>
              {lookup.legalName} needs to file its {filingLabel}.
            </>
          ) : (
            `What ${lookup.legalName} needs to file`
          )}
        </h1>
        {reminderMode && period ? (
          <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted">
            {lookup.alreadyFiledThisYear
              ? `You told us this year's report is already filed. The next one is the ${period.periodYear} report.`
              : `Based on the formation date you entered, the first report is the ${period.periodYear} report.`}
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid items-start gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-6">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          {period ? (
            <DeadlineCard
              rule={rule}
              period={period}
              agencyName={agencyName}
              stateFeeCents={stateFeeCents}
              today={today}
              label={reminderMode ? `Next report: ${filingLabel}` : filingLabel}
            />
          ) : (
            <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7">
              <p className="font-display text-xl font-semibold text-fg">
                {stateName} {rule.filingName}: {dueRuleText(rule.dueRule)}
              </p>
              <p className="text-[15px] text-muted">
                State fee {stateFeeCents === 0 ? "none" : formatCents(stateFeeCents, { trimZeros: true })}.
              </p>
              <OfficialSource href={rule.officialInfoUrl} agency={agencyName} lastVerifiedAt={rule.lastVerifiedAt} />
            </div>
          )}
        </div>

        <aside
          aria-label={reminderMode ? "Reminders" : "Your options"}
          className="grid min-w-0 gap-5 lg:sticky lg:top-[92px] lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {aside}
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">{entered}</div>
      </div>

      <p className="mt-12 max-w-[70ch] text-sm leading-6 text-subtle">
        {site.disclaimer} We don&apos;t provide legal advice. You can file directly with the {agencyName} for the state fee
        alone.
      </p>
    </Container>
  );
}
