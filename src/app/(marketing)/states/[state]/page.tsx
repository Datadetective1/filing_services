import { ArrowRight, ArrowSquareOut, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/analytics/track-view";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DirectoryListing } from "@/components/marketing/directory-listing";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PhotoHero } from "@/components/marketing/photo-hero";
import { StateStatusPanel } from "@/components/marketing/state-status-panel";
import { UnverifiedStatePanel } from "@/components/marketing/unverified-state-panel";
import { UnverifiedStateSections } from "@/components/marketing/unverified-state-sections";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { CalendarDate } from "@/components/visual/calendar-date";
import { FILING_TYPES, getJurisdictionBySlug, isRuleSellable, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { stateFeeText, verifiedText } from "@/lib/compliance/view";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { agencyShortName, dueDayText, dueSummary, feeSummary, latestVerified, sortByDue } from "@/lib/seo/content";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;
// The status panel counts days to the next deadline: render per request so a cached
// (stale-while-revalidate) copy never shows yesterday's countdown.
export const revalidate = 0;

export function generateStaticParams() {
  return listJurisdictions().map((j) => ({ state: j.slug }));
}

function verifiedRules(j: JurisdictionDef): ComplianceRuleDef[] {
  return launchRules(j).filter((r) => r.verificationStatus === "verified");
}

function launchRules(j: JurisdictionDef): ComplianceRuleDef[] {
  // Every launch-enabled filing type we model, for this state.
  return FILING_TYPES.filter((f) => f.launchEnabled).flatMap((f) => rulesForState(j.code, f.code));
}

export async function generateMetadata({ params }: PageProps<"/states/[state]">): Promise<Metadata> {
  const { state } = await params;
  const j = getJurisdictionBySlug(state);
  if (!j) return {};
  const rules = verifiedRules(j);
  const path = `/states/${j.slug}`;
  if (!rules.length) {
    return pageMetadata({
      title: `${j.name} Business Filings`,
      description: `We haven't verified ${j.name}'s business filing requirements yet. Find the official ${j.name} business filing agency and business search.`,
      path,
      noindex: true,
    });
  }
  return pageMetadata({
    title: `${j.name} Business Filings: Annual Reports, Due Dates & Fees`,
    description: `The ${j.name} filings we support, with due dates (${dueSummary(rules)}) and state fees verified against official sources, plus the official agency and business search.`,
    path,
  });
}

export default async function StatePage({ params }: PageProps<"/states/[state]">) {
  const { state } = await params;
  const j = getJurisdictionBySlug(state);
  if (!j) notFound();
  const rules = verifiedRules(j);
  const verified = rules.length > 0;
  const path = `/states/${j.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "States", path: "/states" },
    { name: j.name, path },
  ];

  if (!verified) {
    return (
      <>
        <PhotoHero
          id="state-title"
          breadcrumbs={<Breadcrumbs items={crumbs} />}
          title={j.name}
          lede={
            <p>
              We haven&apos;t verified {j.name}&apos;s filing requirements yet, so we don&apos;t show due dates or fees here.
              The state&apos;s official agency is the place to check.
            </p>
          }
          actions={
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={j.agency.websiteUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "lg")}>
                Visit the official agency
                <ArrowSquareOut size={18} aria-hidden />
                <span className="sr-only">(opens the official website in a new tab)</span>
              </a>
              <a href="#waitlist" className={buttonClasses("secondary", "lg")}>
                Get an email when it&apos;s ready
              </a>
            </div>
          }
          photo="potterWorkshop"
          focus="55% 35%"
          focusWide="30% 40%"
          panel={<UnverifiedStatePanel j={j} />}
        />
        <UnverifiedStateSections
          j={j}
          waitlistLede={`Leave your email and we'll let you know once we've verified ${j.name}'s requirements from official sources.`}
          links={[{ href: "/states", label: "All states" }]}
        />
      </>
    );
  }

  const agency = agencyShortName(j);
  const reviewed = latestVerified(rules);
  const sellable = rules.some(isRuleSellable);
  const annual = rules.filter((r) => r.filingTypeCode === "annual_report");
  const facts = j.code === "PA" ? PENNSYLVANIA_FACTS : null;

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={j.code} />
      <JsonLd data={graph(breadcrumbJsonLd(crumbs))} />

      <PhotoHero
        id="state-title"
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={j.name}
        lede={
          <p>
            The {j.name} filings we support, verified against the {agency}&apos;s official publications, and where to find the
            state&apos;s own filing system.
          </p>
        }
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            {sellable ? (
              <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code}>
                Have us file it
                <ArrowRight size={18} weight="bold" aria-hidden />
              </FilingCtaLink>
            ) : null}
            {annual.length ? (
              <Link href={`/annual-report/${j.slug}`} className={buttonClasses("secondary", "lg")}>
                Annual report guide
              </Link>
            ) : null}
          </div>
        }
        photo="shopCounter"
        focus="50% 42%"
        focusWide="10% 45%"
        panel={annual.length ? <StateStatusPanel j={j} rules={annual} feeText={facts?.directFilingFeeText} /> : null}
      />

      <section aria-labelledby="filings-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
          <div className="grid min-w-0 content-start gap-6">
            <div className="grid gap-3">
              <h2 id="filings-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
                Supported filings
              </h2>
            </div>
            {annual.length ? (
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
                <div className="grid gap-2 p-5 sm:p-6">
                  <h3 className="text-xl font-semibold tracking-tight text-fg">
                    {j.name} {annual[0].filingName}
                    {annual[0].formNumber ? (
                      <span className="ml-2 align-middle font-mono text-[12px] font-normal uppercase tracking-wider text-subtle">
                        {annual[0].formNumber}
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-[15px] leading-7 text-muted">
                    Based on the {agency}&apos;s published requirements: {dueSummary(annual)}. The state fee is {feeSummary(annual)}.
                  </p>
                </div>
                <ul className="divide-y divide-border border-t border-border">
                  {sortByDue(annual).map((r) => (
                    <li key={r.ruleKey}>
                      <Link
                        href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                        className="group grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-surface-2/70 sm:px-6"
                      >
                        <CalendarDate
                          month={r.dueRule.kind === "fixed_annual" ? r.dueRule.month : null}
                          day={r.dueRule.kind === "fixed_annual" ? r.dueRule.day : null}
                          size="sm"
                        />
                        <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                          <span className="font-semibold text-fg group-hover:text-accent">{ENTITY_TYPE_LABELS[r.entityType]}</span>
                          <span className="tnum text-[14px] text-muted">
                            Due {dueDayText(r)} · {stateFeeText({ ...r, nonprofitStateFeeCents: null })}
                          </span>
                        </span>
                        <ArrowRight size={15} weight="bold" aria-hidden className="text-subtle group-hover:text-accent" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-3 border-t border-border bg-surface-2/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <Link
                    href={`/annual-report/${j.slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent"
                  >
                    Full {j.name} annual report guide
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </Link>
                  {sellable ? (
                    <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code} size="md">
                      Have us file it
                    </FilingCtaLink>
                  ) : null}
                </div>
              </div>
            ) : null}
            {reviewed ? (
              <p className="tnum flex items-center gap-2 text-sm text-muted">
                <SealCheck size={16} weight="fill" aria-hidden className="text-accent" />
                Last reviewed {verifiedText(reviewed)}.
              </p>
            ) : null}
          </div>
          <div className="lg:pt-[4.25rem]">
            <DirectoryListing j={j} />
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <DisclaimerNote stateName={j.name} filingUrl={annual[0]?.officialFilingUrl} />
      </Container>
    </>
  );
}
