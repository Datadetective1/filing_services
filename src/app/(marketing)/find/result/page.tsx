import { ArrowLeft, ArrowSquareOut, BellSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { getCurrentUser } from "@/lib/auth/session";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import { formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { periodFor } from "@/lib/filings/customer";
import { readPendingLookup } from "@/lib/lookup/pending";
import { TrackView } from "@/components/analytics/track-view";
import { OfficialSource } from "@/components/compliance/official-source";
import { RequirementCard } from "@/components/compliance/requirement-card";
import { entityPhrase } from "@/components/funnel/entity-noun";
import { TrackedLink } from "@/components/funnel/tracked-link";
import { buttonClasses } from "@/components/ui/button";
import { Container, Facts, SectionTitle } from "@/components/ui/surface";
import { readLookupHomeJurisdiction } from "../lookup-extras";

export const metadata: Metadata = {
  title: "Your filing requirement",
  robots: { index: false, follow: false },
};

function EditLink() {
  return (
    <Link
      href="/find"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
    >
      <ArrowLeft size={16} aria-hidden />
      Edit details
    </Link>
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
    <section aria-labelledby="entered-title" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle className="text-base">
          <span id="entered-title">Details you entered</span>
        </SectionTitle>
        <EditLink />
      </div>
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
      <p className="text-sm text-muted">
        These are the details you typed. We haven&apos;t checked them against the state record.
      </p>
    </section>
  );

  if (!rule || !supported) {
    const searchUrl = lookup.stateCode === "PA" ? PENNSYLVANIA_FACTS.businessSearchUrl : jurisdiction?.agency.businessSearchUrl;
    return (
      <Container className="max-w-2xl py-10 sm:py-16">
        <TrackView event="lookup_completed" stateCode={lookup.stateCode} entityType={lookup.entityType} />
        <div className="grid gap-3">
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">We can&apos;t help with this one yet</h1>
          <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted">
            We don&apos;t have verified filing rules for {entityPhrase(stateName, lookup.entityType)} yet, so we can&apos;t show a
            deadline or file it for you. The official agency is the best place to check what&apos;s required.
          </p>
        </div>

        {lookup.stateCode === "PA" ? (
          <div className="mt-8 grid gap-2 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
            <p className="text-[15px] text-fg">
              Based on the Pennsylvania Department of State&apos;s published requirements: {PENNSYLVANIA_FACTS.exemptTypes}
            </p>
            <OfficialSource
              href={PENNSYLVANIA_FACTS.exemptSource.url}
              agency="Pennsylvania Department of State"
              lastVerifiedAt={PENNSYLVANIA_FACTS.exemptSource.lastVerifiedAt}
            />
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
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

        <div className="mt-12 border-t border-border pt-8">{entered}</div>
        <p className="mt-10 text-sm text-muted">{site.disclaimer}</p>
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
  const currentYear = Number(todayInTimeZone(jurisdiction?.timezone ?? "America/New_York").slice(0, 4));
  // Nothing can be filed yet when the report in view belongs to a future year (a new
  // business, or this year's report is already done): offer reminders instead.
  const reminderMode = period !== null && period.periodYear > currentYear;

  const startPath = reminderMode ? "/file/start?mode=track" : "/file/start";
  const signupHref = `/signup?next=${encodeURIComponent(startPath)}`;

  const actions = reminderMode ? (
    <form action={signedIn ? "/file/start" : "/signup"} method="get" className="contents">
      {signedIn ? <input type="hidden" name="mode" value="track" /> : <input type="hidden" name="next" value={startPath} />}
      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-accent px-5 py-2.5 text-center text-base font-medium text-accent-fg transition-colors hover:bg-accent-hover active:translate-y-px sm:w-auto"
      >
        <BellSimple size={18} aria-hidden />
        Get a reminder when it&apos;s due
      </button>
    </form>
  ) : (
    <>
      <TrackedLink
        href={signedIn ? startPath : signupHref}
        event="filing_cta_clicked"
        stateCode={lookup.stateCode}
        entityType={lookup.entityType}
        className={buttonClasses("primary", "lg")}
      >
        Have us file it
      </TrackedLink>
      <a href={rule.officialFilingUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "lg")}>
        File it yourself
        <ArrowSquareOut size={18} aria-hidden />
        <span className="sr-only">(opens the state&apos;s filing website in a new tab)</span>
      </a>
    </>
  );

  return (
    <Container className="max-w-2xl py-10 sm:py-16">
      <TrackView event="lookup_completed" stateCode={lookup.stateCode} entityType={lookup.entityType} />
      <div className="grid gap-3">
        <EditLink />
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl [overflow-wrap:anywhere]">
          {reminderMode ? "Nothing to file right now" : `What ${lookup.legalName} needs to file`}
        </h1>
        <p className="max-w-[60ch] text-[17px] leading-relaxed text-muted">
          {reminderMode && period
            ? lookup.alreadyFiledThisYear
              ? `You told us this year's report is already filed. The next one is the ${period.periodYear} report, due ${formatLongDate(period.dueDate)}. We can remind you before it's due.`
              : `Based on the formation date you entered, the first report is the ${period.periodYear} report, due ${formatLongDate(period.dueDate)}. We can remind you before it's due.`
            : `The deadline and state fee for ${entityPhrase(stateName, lookup.entityType)}, and what it costs if you'd like us to file it.`}
        </p>
      </div>

      <p className="mt-8 text-sm text-muted">
        <span className="font-medium text-fg">Based on the {agencyName}&apos;s published requirements:</span> the deadline
        and fees shown below. Our filing service is optional and priced separately.
      </p>

      <RequirementCard
        className="mt-3"
        businessName={lookup.legalName}
        rule={rule}
        period={period}
        quote={quote}
        actions={actions}
      />

      {!signedIn ? (
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(startPath)}`} className="font-medium text-fg underline underline-offset-4">
            Sign in
          </Link>{" "}
          to continue.
        </p>
      ) : null}

      <div className="mt-12 border-t border-border pt-8">{entered}</div>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        {site.disclaimer} We don&apos;t provide legal advice. You can file directly with the {agencyName} for the state fee
        alone.
      </p>
    </Container>
  );
}
