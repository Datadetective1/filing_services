import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/analytics/track-view";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DirectoryListing } from "@/components/marketing/directory-listing";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { Badge } from "@/components/ui/badge";
import { FILING_TYPES, getJurisdictionBySlug, isRuleSellable, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { stateFeeText, verifiedText } from "@/lib/compliance/view";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { agencyShortName, dueDayText, dueSummary, feeSummary, latestVerified, sortByDue } from "@/lib/seo/content";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;
export const revalidate = 3600;

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
        <PageIntro
          breadcrumbs={<Breadcrumbs items={crumbs} />}
          title={j.name}
          lede={
            <p>
              We haven&apos;t verified {j.name}&apos;s filing requirements yet, so we don&apos;t show due dates or fees here. The
              state&apos;s official agency is the place to check.
            </p>
          }
        >
          <div>
            <Badge>Not yet verified</Badge>
          </div>
        </PageIntro>
        <Section>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <DirectoryListing j={j} />
            <div className="grid content-start gap-5">
              <SectionHeading
                title={`Get an email when we support ${j.name}`}
                lede={`Leave your email and we'll let you know once we've verified ${j.name}'s requirements from official sources.`}
              />
              <WaitlistForm stateCode={j.code} stateName={j.name} />
            </div>
          </div>
          <div className="mt-14 grid gap-6 border-t border-border pt-8">
            <Link href="/states" className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-fg hover:underline hover:underline-offset-4">
              All states
              <ArrowRight size={16} aria-hidden />
            </Link>
            <DisclaimerNote />
          </div>
        </Section>
      </>
    );
  }

  const agency = agencyShortName(j);
  const reviewed = latestVerified(rules);
  const sellable = rules.some(isRuleSellable);
  const annual = rules.filter((r) => r.filingTypeCode === "annual_report");

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={j.code} />
      <JsonLd data={graph(breadcrumbJsonLd(crumbs))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={j.name}
        lede={
          <p>
            The {j.name} filings we support, verified against the {agency}&apos;s official publications, and where to find the
            state&apos;s own filing system.
          </p>
        }
      >
        <div>
          <Badge tone="success">Supported</Badge>
        </div>
      </PageIntro>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          <div className="grid min-w-0 content-start gap-8">
            <SectionHeading title="Supported filings" />
            {annual.length ? (
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
                <div className="grid gap-2 p-5 sm:p-6">
                  <h3 className="text-xl font-semibold tracking-tight text-fg">
                    {j.name} {annual[0].filingName}
                    {annual[0].formNumber ? <span className="ml-2 text-sm font-normal text-subtle">{annual[0].formNumber}</span> : null}
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
                        className="flex min-h-12 flex-col justify-center gap-0.5 px-5 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
                      >
                        <span className="text-[15px] text-fg">{ENTITY_TYPE_LABELS[r.entityType]}</span>
                        <span className="tnum text-sm text-muted">
                          Due {dueDayText(r)} · {stateFeeText({ ...r, nonprofitStateFeeCents: null })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-3 border-t border-border bg-surface-2/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <Link
                    href={`/annual-report/${j.slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-fg hover:underline hover:underline-offset-4"
                  >
                    Full {j.name} annual report guide
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                  {sellable ? (
                    <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code} size="md">
                      Have us file it
                    </FilingCtaLink>
                  ) : null}
                </div>
              </div>
            ) : null}
            {reviewed ? <p className="tnum text-sm text-muted">Last reviewed {verifiedText(reviewed)}.</p> : null}
          </div>
          <DirectoryListing j={j} />
        </div>
        <DisclaimerNote className="mt-12" stateName={j.name} filingUrl={annual[0]?.officialFilingUrl} />
      </Section>
    </>
  );
}
