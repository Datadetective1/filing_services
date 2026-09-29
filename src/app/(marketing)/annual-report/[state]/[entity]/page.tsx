import { ArrowRight, ArrowUpRight, Info, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { RequirementCard } from "@/components/compliance/requirement-card";
import { Photo } from "@/components/media/photo";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { RequiredInfoSheet } from "@/components/marketing/required-info-sheet";
import { SourceList } from "@/components/marketing/source-list";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { CalendarDate } from "@/components/visual/calendar-date";
import { publicQuote } from "@/lib/compliance/public-quote";
import { getJurisdiction, getJurisdictionBySlug, RULES, rulesForState } from "@/lib/compliance/registry";
import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { dueRuleText, lateFeeText, stateFeeText, verifiedText } from "@/lib/compliance/view";
import { formatLongDate } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { entityTypeFromSlug, ENTITY_TYPE_SLUGS, type EntityType } from "@/lib/domain/types";
import type { PhotoKey } from "@/lib/media/photos";
import {
  agencyShortName,
  filingWindowText,
  governorInfo,
  groupSources,
  requiredInfoForRule,
} from "@/lib/seo/content";
import { article, ENTITY_COPY } from "@/lib/seo/entities";
import { breadcrumbJsonLd, faqJsonLd, graph, serviceJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { marketingPeriod } from "@/lib/seo/period";

export const dynamicParams = false;
export const revalidate = 3600;

/** One photograph per entity type, so each guide opens on its own scene. */
const ENTITY_PHOTOS: Record<EntityType, { photo: PhotoKey; focus?: string }> = {
  llc: { photo: "woodworker", focus: "58% 42%" },
  corporation: { photo: "shopCounter", focus: "62% 40%" },
  nonprofit_corporation: { photo: "florist", focus: "55% 55%" },
  lp: { photo: "potterWorkshop", focus: "52% 35%" },
  llp: { photo: "tailorSewingPhone", focus: "58% 40%" },
  electing_partnership: { photo: "cafeLaptop", focus: "50% 62%" },
  professional_association: { photo: "reliefDocument", focus: "45% 40%" },
  business_trust: { photo: "storefrontAwning", focus: "50% 38%" },
  other: { photo: "cafeLaptop", focus: "50% 60%" },
};

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

/** A guide section laid out as a row: heading on the left, content on the right. */
function Row({ id, title, lede, children }: { id: string; title: ReactNode; lede?: ReactNode; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-24 gap-5 border-t border-border py-10 sm:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12"
    >
      <div className="grid content-start gap-2">
        <h2 id={`${id}-title`} className="text-[24px] font-semibold leading-[1.15] text-fg text-balance sm:text-[27px]">
          {title}
        </h2>
        {lede ? <p className="text-[15px] leading-6 text-muted">{lede}</p> : null}
      </div>
      <div className="grid min-w-0 content-start gap-5">{children}</div>
    </section>
  );
}

const bodyText = "grid max-w-[68ch] gap-4 text-[16px] leading-7 text-muted";

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
  const scene = ENTITY_PHOTOS[rule.entityType];

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

  const facts = [
    { term: "Due date", value: dueRuleText(rule.dueRule) },
    ...(filingWindow ? [{ term: "Filing window", value: filingWindow }] : []),
    { term: "State fee", value: stateFeeText(rule) },
    { term: "Late fee", value: lateFeeText(rule) },
    { term: "First report", value: firstReportText },
    { term: "Form", value: rule.formNumber ? `${rule.filingName} (${rule.formNumber})` : rule.filingName },
  ];

  const officialLinks = [
    { href: rule.officialFilingUrl, label: "Official online filing" },
    { href: j.agency.businessSearchUrl, label: "Official business search" },
    { href: rule.officialInfoUrl, label: `${agency}: annual reports` },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));

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

      {/* Hero: the answer first */}
      <section aria-labelledby="entity-title" className="overflow-hidden">
        <Container className="grid grid-cols-1 gap-x-14 gap-y-8 pb-14 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:grid-rows-[auto_1fr] lg:pb-20 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)]">
          <div className="grid content-start gap-5 lg:col-start-1 lg:row-start-1">
            <Breadcrumbs items={crumbs} />
            <h1
              id="entity-title"
              className="max-w-[18ch] text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-fg sm:text-[50px] lg:text-[56px]"
            >
              {j.name} annual report for <span className="mark-highlight">{copy.plural}</span>
            </h1>
            <p className="max-w-[48ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              Based on the {agency}&apos;s published requirements, {j.name} {copy.plural} file an annual report by {dueDay} each
              year. {feeSentence} {rule.lateFeeCents === null ? "There is no state late fee." : null}
            </p>
          </div>

          <div className="grid content-start gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <RequirementCard
              rule={rule}
              period={period}
              quote={quote}
              headingAs="h2"
              actions={
                <FilingCtaLink href={findHref} stateCode={j.code} entityType={rule.entityType}>
                  Have us file it
                  <ArrowRight size={18} weight="bold" aria-hidden />
                </FilingCtaLink>
              }
            />
            {missed ? (
              <p className="flex items-start gap-2 px-1 text-sm leading-6 text-muted">
                <Info size={16} aria-hidden className="mt-1 shrink-0 text-accent" />
                <span>
                  The {missed.periodYear} report was due {formatLongDate(missed.dueDate)}. If your {copy.singular} hasn&apos;t
                  filed it yet, it can still be filed. {rule.lateFeeSummary}
                </span>
              </p>
            ) : null}
          </div>

          <Photo
            photo={scene.photo}
            focus={scene.focus}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-[16/10] lg:col-start-1 lg:row-start-2 lg:aspect-[3/2] lg:self-start"
          />
        </Container>
      </section>

      <Container className="pb-20">
        <div className="max-w-5xl">
          {/* Key facts */}
          <Row id="facts" title="At a glance">
            <dl className="grid overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border sm:grid-cols-2 [&>div]:bg-surface gap-px">
              {facts.map((f) => (
                <div key={f.term} className="grid content-start gap-1 px-4 py-3.5 sm:px-5">
                  <dt className="text-[13px] font-medium text-muted">{f.term}</dt>
                  <dd className="text-[15px] font-medium leading-6 text-fg">{f.value}</dd>
                </div>
              ))}
            </dl>
          </Row>

          {/* Governor */}
          <Row
            id="governor"
            title={`Who is the “governor” for ${a} ${copy.singular}?`}
            lede={`${j.name}'s annual report asks for the name of at least one governor. The term covers different people depending on the entity type.`}
          >
            <div className="grid overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                  <UsersThree size={22} weight="duotone" />
                </span>
                <div className="grid gap-1.5">
                  <p className="font-display text-lg font-semibold text-fg">
                    For {a} {copy.singular}: {governor.label.toLowerCase()}
                  </p>
                  {governor.help ? <p className="text-[15px] leading-7 text-muted">{governor.help}</p> : null}
                  {governor.titles.length ? (
                    <p className="mt-1 text-[13px] font-medium text-subtle">Common titles</p>
                  ) : null}
                  {governor.titles.length ? (
                    <ul aria-label="Common titles" className="flex flex-wrap gap-1.5">
                      {governor.titles.map((t) => (
                        <li key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-fg">
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
              <div className="border-t border-dashed border-border bg-surface-2/50 p-5 sm:px-6">
                <p className="font-semibold text-fg">
                  Principal officers {governor.officersRequired ? "(required)" : "(if any)"}
                </p>
                {governor.officerHelp ? <p className="mt-1.5 text-[15px] leading-7 text-muted">{governor.officerHelp}</p> : null}
              </div>
            </div>
          </Row>

          {/* Who must file */}
          <Row id="who" title="Who must file">
            <p className={bodyText}>{rule.whoMustFile}</p>
          </Row>

          {/* Required information */}
          <Row
            id="required"
            title="What the report includes"
            lede="No financial information. You confirm or update the business's details on record."
          >
            <RequiredInfoSheet
              title={`${j.name} ${copy.title} ${rule.filingName.toLowerCase()}`}
              formNumber={rule.formNumber}
              items={requiredInfoForRule(rule)}
            />
          </Row>

          {/* Late filing */}
          <Row id="late" title="If the report is late">
            <div className={bodyText}>
              <p>{lateFeeText(rule)}</p>
              <p>{rule.consequenceSummary}</p>
            </div>
          </Row>

          {/* How to file directly */}
          <Row id="direct" title="Filing it yourself">
            <div className={bodyText}>
              <p>{rule.filingMethodSummary}</p>
              <p>{rule.processingSummary}</p>
            </div>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              {officialLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-[15px] font-semibold leading-snug text-fg transition-colors hover:border-fg/40 hover:bg-surface-2"
                  >
                    {l.label}
                    <ArrowUpRight size={15} weight="bold" aria-hidden className="shrink-0" />
                    <span className="sr-only">(opens the official website in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </Row>

          {/* FAQ */}
          <Row id="faq" title="Questions">
            <FaqList items={rule.faq} />
          </Row>

          {/* Sources */}
          <Row
            id="sources"
            title="Official sources"
            lede={`The facts on this page come from these publications. Last reviewed ${verifiedText(rule.lastVerifiedAt)}.`}
          >
            <SourceList groups={groupSources(rule.sources)} />
          </Row>

          {/* Related */}
          <nav aria-labelledby="related-title" className="grid gap-5 border-t border-border py-10 sm:py-12">
            <h2 id="related-title" className="text-[24px] font-semibold leading-tight text-fg sm:text-[27px]">
              Other {j.name} entity types
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {siblings.map((r) => (
                <li key={r.ruleKey}>
                  <Link
                    href={`${statePath}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                    className="group flex min-h-16 items-center gap-3.5 rounded-[var(--radius-surface)] border border-border bg-surface p-3 pr-4 transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-card"
                  >
                    <CalendarDate
                      month={r.dueRule.kind === "fixed_annual" ? r.dueRule.month : null}
                      day={r.dueRule.kind === "fixed_annual" ? r.dueRule.day : null}
                      size="sm"
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-semibold leading-snug text-fg group-hover:text-accent">{ENTITY_COPY[r.entityType].title}</span>
                      <span className="tnum text-[13px] text-muted">Due {dueRuleText(r.dueRule).replace(" each year", "")}</span>
                    </span>
                    <ArrowRight size={16} weight="bold" aria-hidden className="shrink-0 text-subtle group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={statePath} className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}>
              {j.name} annual report guide
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </nav>

          <DisclaimerNote stateName={j.name} filingUrl={rule.officialFilingUrl} />
        </div>
      </Container>
    </>
  );
}
