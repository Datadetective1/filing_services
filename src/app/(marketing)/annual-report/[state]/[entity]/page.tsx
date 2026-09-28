import { ArrowRight, ArrowUpRight, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { RequirementCard } from "@/components/compliance/requirement-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, SectionHeading } from "@/components/marketing/section";
import { SourceList } from "@/components/marketing/source-list";
import { Facts } from "@/components/ui/surface";
import { publicQuote } from "@/lib/compliance/public-quote";
import { getJurisdiction, getJurisdictionBySlug, RULES, rulesForState } from "@/lib/compliance/registry";
import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { dueRuleText, lateFeeText, stateFeeText, verifiedText } from "@/lib/compliance/view";
import { formatLongDate } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { entityTypeFromSlug, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import {
  agencyShortName,
  filingWindowText,
  governorInfo,
  groupSources,
  requiredInfoForRule,
} from "@/lib/seo/content";
import { article, ENTITY_COPY, joinList } from "@/lib/seo/entities";
import { breadcrumbJsonLd, faqJsonLd, graph, serviceJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { marketingPeriod } from "@/lib/seo/period";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return RULES.filter((r) => r.verificationStatus === "verified").flatMap((r) => {
    const j = getJurisdiction(r.stateCode);
    return j ? [{ state: j.slug, entity: ENTITY_TYPE_SLUGS[r.entityType] }] : [];
  });
}

function resolve(stateSlug: string, entitySlug: string): { j: JurisdictionDef; rule: ComplianceRuleDef } | null {
  const j = getJurisdictionBySlug(stateSlug);
  const entityType = entityTypeFromSlug(entitySlug);
  if (!j || !entityType) return null;
  const rule = rulesForState(j.code).find((r) => r.entityType === entityType && r.verificationStatus === "verified");
  return rule ? { j, rule } : null;
}

export async function generateMetadata({ params }: PageProps<"/annual-report/[state]/[entity]">): Promise<Metadata> {
  const { state, entity } = await params;
  const hit = resolve(state, entity);
  if (!hit) return {};
  const { j, rule } = hit;
  const copy = ENTITY_COPY[rule.entityType];
  return pageMetadata({
    title: `${j.name} ${copy.title} Annual Report: Due Date, Fee & Filing`,
    description: `${j.name} ${copy.plural} file an annual report by ${dueRuleText(rule.dueRule).replace(" each year", "")} each year. State fee: ${stateFeeText(rule)}. Who counts as a governor, what to report and how to file, from official sources.`,
    path: `/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[rule.entityType]}`,
  });
}

export default async function EntityAnnualReportPage({ params }: PageProps<"/annual-report/[state]/[entity]">) {
  const { state, entity } = await params;
  const hit = resolve(state, entity);
  if (!hit) notFound();
  const { j, rule } = hit;

  const copy = ENTITY_COPY[rule.entityType];
  const agency = agencyShortName(j);
  const statePath = `/annual-report/${j.slug}`;
  const path = `${statePath}/${ENTITY_TYPE_SLUGS[rule.entityType]}`;
  const { period, missed } = marketingPeriod(rule);
  const quote = await publicQuote(rule);
  const governor = governorInfo(rule);
  const filingWindow = filingWindowText(rule);
  const dueDay = dueRuleText(rule.dueRule).replace(" each year", "");
  const siblings = rulesForState(j.code).filter((r) => r.ruleKey !== rule.ruleKey && r.verificationStatus === "verified");
  const findHref = `/find?state=${j.code}&entity=${rule.entityType}`;

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Annual reports", path: "/annual-report" },
    { name: j.name, path: statePath },
    { name: copy.title, path },
  ];

  const firstReportText =
    rule.firstDueRule.kind === "year_after_formation"
      ? `The first report is due in the calendar year after the ${copy.singular} forms in ${j.name} or first registers there as a foreign entity.`
      : `The first report is due in the year the ${copy.singular} forms.`;

  const feeSentence =
    rule.stateFeeCents === 0
      ? "There is no state fee."
      : `The state fee is ${formatCents(rule.stateFeeCents, { trimZeros: true })}${
          rule.nonprofitStateFeeCents === 0 ? `, and ${copy.plural} with a not-for-profit purpose pay nothing` : ""
        }.`;
  const a = article(copy.singular);

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={j.code} entityType={rule.entityType} />
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          faqJsonLd(rule.faq),
          serviceJsonLd({
            name: `${j.name} ${copy.title} ${rule.filingName} filing service`,
            description: `${site.name} prepares and submits the ${j.name} ${rule.filingName} for ${copy.plural}, using information the business provides and authorizes.`,
            path,
            stateName: j.name,
            offers: quote ? [{ name: `${j.name} ${copy.title} ${rule.filingName} filing`, path, quote }] : [],
          }),
        )}
      />

      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`${j.name} annual report for ${copy.plural}`}
        lede={
          <p>
            Based on the {agency}&apos;s published requirements, {j.name} {copy.plural} file an annual report by {dueDay} each
            year. {feeSentence} {rule.lateFeeCents === null ? "There is no state late fee." : null}
          </p>
        }
      />

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div className="order-2 grid min-w-0 content-start gap-16 lg:order-1">
          {/* Key facts */}
          <section aria-labelledby="facts-title" className="grid gap-6">
            <SectionHeading id="facts-title" title="At a glance" />
            <Facts
              items={[
                { term: "Due date", value: dueRuleText(rule.dueRule) },
                ...(filingWindow ? [{ term: "Filing window", value: filingWindow }] : []),
                { term: "State fee", value: stateFeeText(rule) },
                { term: "Late fee", value: lateFeeText(rule) },
                { term: "First report", value: firstReportText },
                { term: "Form", value: rule.formNumber ? `${rule.filingName} (${rule.formNumber})` : rule.filingName },
              ]}
            />
          </section>

          {/* Governor */}
          <section aria-labelledby="governor-title" className="grid gap-5">
            <SectionHeading
              id="governor-title"
              title={`Who is the “governor” for ${a} ${copy.singular}?`}
              lede={`${j.name}'s annual report asks for the name of at least one governor. The term covers different people depending on the entity type.`}
            />
            <div className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <UsersThree size={22} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <div className="grid gap-1.5">
                  <p className="font-medium text-fg">
                    For {a} {copy.singular}: {governor.label.toLowerCase()}
                  </p>
                  {governor.help ? <p className="text-[15px] leading-7 text-muted">{governor.help}</p> : null}
                  {governor.titles.length ? (
                    <p className="text-sm text-subtle">Common titles: {joinList(governor.titles)}</p>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="font-medium text-fg">
                  Principal officers {governor.officersRequired ? "(required)" : "(if any)"}
                </p>
                {governor.officerHelp ? <p className="mt-1.5 text-[15px] leading-7 text-muted">{governor.officerHelp}</p> : null}
              </div>
            </div>
          </section>

          {/* Who must file */}
          <section aria-labelledby="who-title" className="grid gap-5">
            <SectionHeading id="who-title" title="Who must file" />
            <p className="max-w-[68ch] text-[15px] leading-7 text-muted sm:text-base">{rule.whoMustFile}</p>
          </section>

          {/* Required information */}
          <section aria-labelledby="required-title" className="grid gap-5">
            <SectionHeading
              id="required-title"
              title="What the report includes"
              lede="No financial information. You confirm or update the business's details on record."
            />
            <ul className="grid max-w-[68ch] gap-3">
              {requiredInfoForRule(rule).map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-7 text-muted sm:text-base">
                  <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Late filing */}
          <section aria-labelledby="late-title" className="grid gap-5">
            <SectionHeading id="late-title" title="If the report is late" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>{lateFeeText(rule)}</p>
              <p>{rule.consequenceSummary}</p>
            </div>
          </section>

          {/* How to file directly */}
          <section aria-labelledby="direct-title" className="grid gap-5">
            <SectionHeading id="direct-title" title="Filing it yourself" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>{rule.filingMethodSummary}</p>
              <p>{rule.processingSummary}</p>
            </div>
            <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {[
                { href: rule.officialFilingUrl, label: "Official online filing" },
                { href: j.agency.businessSearchUrl, label: "Official business search" },
                { href: rule.officialInfoUrl, label: `${agency}: annual reports` },
              ]
                .filter((l): l is { href: string; label: string } => Boolean(l.href))
                .map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                    >
                      {l.label}
                      <ArrowUpRight size={15} aria-hidden />
                      <span className="sr-only">(opens the official website in a new tab)</span>
                    </a>
                  </li>
                ))}
            </ul>
          </section>

          {/* FAQ */}
          <section aria-labelledby="faq-title" className="grid gap-6">
            <SectionHeading id="faq-title" title="Questions" />
            <FaqList items={rule.faq} />
          </section>

          {/* Sources */}
          <section aria-labelledby="sources-title" className="grid gap-6">
            <SectionHeading
              id="sources-title"
              title="Official sources"
              lede={`The facts on this page come from these publications. Last reviewed ${verifiedText(rule.lastVerifiedAt)}.`}
            />
            <SourceList groups={groupSources(rule.sources)} />
          </section>

          {/* Related */}
          <nav aria-labelledby="related-title" className="grid gap-5 border-t border-border pt-10">
            <h2 id="related-title" className="text-lg font-semibold tracking-tight text-fg">
              Other {j.name} entity types
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {siblings.map((r) => (
                <li key={r.ruleKey}>
                  <Link
                    href={`${statePath}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2.5 hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="text-[15px] text-fg">{ENTITY_COPY[r.entityType].title}</span>
                    <span className="tnum flex shrink-0 items-center gap-2 text-sm text-muted">
                      {dueRuleText(r.dueRule).replace(" each year", "")}
                      <ArrowRight size={14} aria-hidden className="text-subtle group-hover:text-fg" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={statePath}
              className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-fg hover:underline hover:underline-offset-4"
            >
              {j.name} annual report guide
              <ArrowRight size={16} aria-hidden />
            </Link>
          </nav>

          <DisclaimerNote stateName={j.name} filingUrl={rule.officialFilingUrl} />
        </div>

        {/* Requirement card: first on mobile, sticky on desktop */}
        <aside className="order-1 lg:order-2">
          <div className="grid gap-3 lg:sticky lg:top-8">
            <RequirementCard
              rule={rule}
              period={period}
              quote={quote}
              actions={
                <FilingCtaLink href={findHref} stateCode={j.code} entityType={rule.entityType}>
                  Have us file it
                </FilingCtaLink>
              }
            />
            {missed ? (
              <p className="px-1 text-sm leading-6 text-muted">
                The {missed.periodYear} report was due {formatLongDate(missed.dueDate)}. If your {copy.singular} hasn&apos;t filed
                it yet, it can still be filed. {rule.lateFeeSummary}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
