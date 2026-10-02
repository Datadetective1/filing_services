import {
  ArrowRight,
  ArrowSquareOut,
  ArrowUpRight,
  CaretDown,
  Info,
  ProhibitInset,
  SealCheck,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { GuideSection, GuideText } from "@/components/marketing/guide-section";
import { JsonLd } from "@/components/marketing/json-ld";
import { OnThisPageAside, OnThisPageDisclosure } from "@/components/marketing/on-this-page";
import { PhotoHero } from "@/components/marketing/photo-hero";
import { RequiredInfoSheet } from "@/components/marketing/required-info-sheet";
import { SourceList } from "@/components/marketing/source-list";
import { StateStatusPanel } from "@/components/marketing/state-status-panel";
import { UnverifiedStatePanel } from "@/components/marketing/unverified-state-panel";
import { UnverifiedStateSections } from "@/components/marketing/unverified-state-sections";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { CalendarDate } from "@/components/visual/calendar-date";
import { FilingYearChart } from "@/components/visual/filing-year-chart";
import { Receipt } from "@/components/visual/receipt";
import { publicQuote } from "@/lib/compliance/public-quote";
import { getJurisdictionBySlug, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { ComplianceRuleDef, FaqItem, JurisdictionDef } from "@/lib/compliance/types";
import { lateFeeText, stateFeeText, verifiedText } from "@/lib/compliance/view";
import { todayInTimeZone } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import {
  agencyShortName,
  commonRequiredInfo,
  dueDayText,
  dueGroups,
  dueSummary,
  feeSummary,
  filingWindowText,
  groupSources,
  latestVerified,
  stateFaq,
} from "@/lib/seo/content";
import { ENTITY_COPY, joinList } from "@/lib/seo/entities";
import { breadcrumbJsonLd, faqJsonLd, graph, serviceJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;
// The status panel counts days to the next deadline: render per request so a cached
// (stale-while-revalidate) copy never shows yesterday's countdown.
export const revalidate = 0;

export function generateStaticParams() {
  return listJurisdictions().map((j) => ({ state: j.slug }));
}

function verifiedRules(j: JurisdictionDef): ComplianceRuleDef[] {
  return rulesForState(j.code).filter((r) => r.verificationStatus === "verified");
}

/** State-specific facts that only exist for states with a facts module. */
function stateFacts(code: string) {
  return code === "PA" ? PENNSYLVANIA_FACTS : null;
}

export async function generateMetadata({ params }: PageProps<"/annual-report/[state]">): Promise<Metadata> {
  const { state } = await params;
  const j = getJurisdictionBySlug(state);
  if (!j) return {};
  const rules = verifiedRules(j);
  const path = `/annual-report/${j.slug}`;
  if (!rules.length) {
    return pageMetadata({
      title: `${j.name} Annual Report`,
      description: `We haven't verified ${j.name}'s annual report requirements yet, so we don't show due dates or fees. Find the official ${j.name} business filing agency.`,
      path,
      noindex: true,
    });
  }
  return pageMetadata({
    title: `${j.name} Annual Report: Due Dates, Fees & How to File`,
    description: `${j.name} annual report due dates by entity type (${dueSummary(rules)}), the state fee (${feeSummary(rules)}), late-filing rules and how to file, from official sources.`,
    path,
  });
}

export default async function StateAnnualReportPage({ params }: PageProps<"/annual-report/[state]">) {
  const { state } = await params;
  const j = getJurisdictionBySlug(state);
  if (!j) notFound();
  const rules = verifiedRules(j);
  if (!rules.length) return <UnverifiedState j={j} />;
  return <VerifiedState j={j} rules={rules} />;
}

// ---------------------------------------------------------------------------
// Verified state: full guide
// ---------------------------------------------------------------------------

const TOC = [
  { id: "due-dates", label: "Due dates" },
  { id: "who-files", label: "Who must file" },
  { id: "fees", label: "State fees" },
  { id: "late", label: "Late filing" },
  { id: "required", label: "Information required" },
  { id: "how-to-file", label: "How filing works" },
  { id: "entity-guides", label: "Guides by entity type" },
  { id: "faq", label: "Questions" },
  { id: "sources", label: "Official sources" },
];

async function VerifiedState({ j, rules }: { j: JurisdictionDef; rules: ComplianceRuleDef[] }) {
  const path = `/annual-report/${j.slug}`;
  const agency = agencyShortName(j);
  const facts = stateFacts(j.code);
  const first = rules[0];
  const quotes = await Promise.all(rules.map((r) => publicQuote(r)));
  let exampleIndex = rules.findIndex((r, i) => r.entityType === "llc" && quotes[i]);
  if (exampleIndex < 0) exampleIndex = quotes.findIndex(Boolean);
  const exampleRule = exampleIndex >= 0 ? rules[exampleIndex] : null;
  const exampleQuote = exampleIndex >= 0 ? quotes[exampleIndex] : null;
  const reviewed = latestVerified(rules);
  const noLateFee = rules.every((r) => r.lateFeeCents === null);
  const lateSentence = noLateFee ? "there is no state late fee" : "a state late charge can apply in some cases (see below)";
  const firstReportYearAfter = rules.every((r) => r.firstDueRule.kind === "year_after_formation");
  const feeText = facts?.directFilingFeeText ?? feeSummary(rules);
  const feeAmount = /^\$\d+(?:\.\d+)?/.exec(feeText)?.[0] ?? feeText;
  const feeNote = /\((.+)\)$/.exec(feeText)?.[1] ?? null;
  const filingHost = new URL(first.officialFilingUrl).host;
  const groups = dueGroups(rules);
  const today = todayInTimeZone(j.timezone);
  const chartRows = groups.every((g) => g.month && g.dayOfMonth)
    ? groups.map((g) => ({ label: g.who, month: g.month as number, day: g.dayOfMonth as number }))
    : null;

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Annual reports", path: "/annual-report" },
    { name: j.name, path },
  ];

  const faq: FaqItem[] = [
    ...stateFaq(rules, j.name, agency),
    {
      q: `Is ${site.name} part of the ${j.name} government?`,
      a: `No. ${site.name} is a private filing service. We are not affiliated with or endorsed by the ${agency} or any other government agency. You can file directly with the state and pay only the state fee.`,
    },
  ];

  const allSources = rules.flatMap((r) => r.sources);
  if (facts) allSources.push(facts.exemptSource);
  const sourceGroups = groupSources(allSources);

  const carNotes = [
    ...new Set(
      rules.flatMap((r) =>
        r.faq.filter((f) => f.q.includes("Certificate of Annual Registration")).map((f) => f.a.replace(/^No\.\s*/, "")),
      ),
    ),
  ];

  const offers = rules.flatMap((r, i) => {
    const q = quotes[i];
    return q
      ? [{ name: `${j.name} ${ENTITY_COPY[r.entityType].title} ${r.filingName} filing`, path: `${path}/${ENTITY_TYPE_SLUGS[r.entityType]}`, quote: q }]
      : [];
  });

  const officialLinks = [
    { href: first.officialFilingUrl, label: "Official online filing" },
    { href: facts?.businessSearchUrl ?? j.agency.businessSearchUrl, label: "Official business search" },
    { href: first.officialInfoUrl, label: `${agency}: annual reports` },
  ].filter((l): l is { href: string; label: string } => Boolean(l.href));

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={j.code} />
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          faqJsonLd(faq),
          serviceJsonLd({
            name: `${j.name} ${first.filingName} filing service`,
            description: `${site.name} prepares and submits the ${j.name} ${first.filingName} for businesses, using information the business provides and authorizes.`,
            path,
            stateName: j.name,
            offers,
          }),
        )}
      />

      <PhotoHero
        id="state-title"
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={
          <>
            {j.name} <span className="mark-highlight">annual report</span>
          </>
        }
        lede={
          <p>
            {facts ? `Since ${facts.firstRequiredYear}, most` : "Most"} businesses registered in {j.name} file one every
            year. The due date depends on the type of entity.
          </p>
        }
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code}>
              Have us file it
              <ArrowRight size={18} weight="bold" aria-hidden />
            </FilingCtaLink>
            <a href={first.officialFilingUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "lg")}>
              File it yourself
              <ArrowSquareOut size={18} aria-hidden />
              <span className="sr-only">(opens the state&apos;s filing website in a new tab)</span>
            </a>
          </div>
        }
        note={
          <p className="flex max-w-[46ch] items-start gap-2 text-sm leading-6 text-muted">
            <ShieldCheck size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <span>
              Filing it yourself at {filingHost} costs only the state fee: {feeText}.
            </span>
          </p>
        }
        photo="storefrontAwning"
        focus="50% 38%"
        focusWide="42% 50%"
        panel={<StateStatusPanel j={j} rules={rules} feeText={facts?.directFilingFeeText} />}
      />

      <Container className="grid grid-cols-1 gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_13.5rem] lg:gap-16">
        <div className="grid min-w-0 content-start gap-20 pt-4 sm:gap-24">
          <OnThisPageDisclosure items={TOC} className="-mb-8" />

          {/* Due dates */}
          <GuideSection
            id="due-dates"
            title="Due dates by entity type"
            lede={
              <p>
                Based on the {agency}&apos;s published requirements, most domestic and foreign entities registered in {j.name}{" "}
                must file {rules[0].filingName === "Annual Report" ? "an annual report" : `the ${rules[0].filingName}`} every year:{" "}
                {dueSummary(rules)}. The state fee is {feeText}, and {lateSentence}.{" "}
                {rules.every((r) => r.dueRule.kind === "fixed_annual")
                  ? "The filing window opens January 1 of the report year."
                  : rules[0].filingWindowDaysBefore
                    ? `It can be filed up to ${rules[0].filingWindowDaysBefore} days before the due date.`
                    : null}
              </p>
            }
          >
            {chartRows ? <FilingYearChart rows={chartRows} today={today} /> : null}

            <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
              {groups.map((g) => {
                const window = filingWindowText(g.rules[0]);
                return (
                  <div key={g.day} className="grid gap-3 p-4 sm:p-5 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
                    <div className="flex items-center gap-3.5 md:items-start">
                      <CalendarDate month={g.month} day={g.dayOfMonth} />
                      <div className="grid gap-0.5">
                        <p className="font-display text-lg font-semibold leading-tight text-fg">Due {g.day}</p>
                        <p className="tnum text-[13px] leading-5 text-muted">
                          Filing window: {window ?? "Varies"}
                        </p>
                      </div>
                    </div>
                    <ul className="grid">
                      {g.rules.map((r) => (
                        <li key={r.ruleKey} className="border-b border-dashed border-border last:border-b-0">
                          <Link
                            href={`${path}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                            className="group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-2"
                          >
                            <span className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                              <span className="font-semibold text-fg underline decoration-transparent underline-offset-4 transition-colors group-hover:text-accent group-hover:decoration-accent/40">
                                {ENTITY_TYPE_LABELS[r.entityType]}
                              </span>
                              <span className="tnum text-[14px] text-muted">
                                {r.stateFeeCents === 0 ? stateFeeText(r) : `State fee ${stateFeeText(r)}`}
                              </span>
                            </span>
                            <ArrowRight size={14} weight="bold" aria-hidden className="text-subtle group-hover:text-accent" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {firstReportYearAfter ? (
              <p className="flex max-w-[68ch] items-start gap-2.5 text-[15px] leading-7 text-muted">
                <Info size={18} aria-hidden className="mt-1 shrink-0 text-accent" />
                <span>
                  A business files its first report in the calendar year after it forms in {j.name} or first registers there
                  as a foreign entity. A business formed this year has nothing to file until next year.
                </span>
              </p>
            ) : null}
          </GuideSection>

          {/* Who must file */}
          <GuideSection id="who-files" title="Who must file">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
              <GuideText>
                <p>
                  Based on the {agency}&apos;s published requirements, every active domestic and foreign{" "}
                  {joinList(rules.map((r) => ENTITY_COPY[r.entityType].singular))} registered with the {agency} files an
                  annual report.
                  {facts ? ` The requirement began in ${facts.firstRequiredYear}.` : null}
                </p>
                {carNotes.length ? (
                  <details className="group rounded-[var(--radius-control)] border border-border bg-surface">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
                      A separate filing some entities also make
                      <CaretDown size={16} weight="bold" aria-hidden className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-border px-4 pb-4 pt-3 text-[15px] leading-7">
                      <ul className="grid list-disc gap-1.5 pl-5">
                        {carNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm">The annual report does not replace it.</p>
                    </div>
                  </details>
                ) : null}
              </GuideText>
              {facts ? (
                <div className="grid content-start gap-2 rounded-[var(--radius-surface)] bg-surface-2 p-5">
                  <p className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
                    <ProhibitInset size={20} weight="duotone" aria-hidden className="text-muted" />
                    Not required to file
                  </p>
                  <p className="text-[15px] leading-7 text-muted">{facts.exemptTypes}</p>
                </div>
              ) : null}
            </div>
          </GuideSection>

          {/* Fees */}
          <GuideSection id="fees" title="State fees">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-10">
              <GuideText>
                <p>
                  Based on the {agency}&apos;s published requirements, the state fee is {feeSummary(rules)}. The fee is paid to
                  the state when the report is filed. The due-date list above shows the fee for each entity type.
                </p>
                <p>
                  If you have us file it, we pass the state fee through at cost and show our service fee as a separate line
                  before you pay.
                </p>
              </GuideText>
              <div className="grid gap-2 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">State fee</p>
                <p className="tnum font-display text-[44px] font-semibold leading-none text-fg">{feeAmount}</p>
                {feeNote ? <p className="text-[15px] font-semibold text-fg">{feeNote}</p> : null}
                <p className="text-[14px] leading-6 text-muted">Paid to {j.name} when the report is filed.</p>
              </div>
            </div>
          </GuideSection>

          {/* Late filing */}
          <GuideSection id="late" title="Late fee and consequences">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
              <GuideText>
                <p>{lateFeeText(first)}</p>
                <p>{first.consequenceSummary}</p>
                {facts ? (
                  <p className="font-semibold text-fg">
                    Enforcement starts with reports due in {facts.enforcementStartsWithReportsDueIn}.
                  </p>
                ) : null}
              </GuideText>
              {facts ? (
                <ol aria-label="What happens after a missed due date" className="grid content-start gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
                  <li className="relative flex gap-3.5">
                    <span aria-hidden className="absolute -bottom-5 left-[11px] top-7 w-0.5 bg-border-strong" />
                    <span aria-hidden className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-highlight-strong bg-highlight" />
                    <div className="grid gap-0.5">
                      <p className="font-semibold text-fg">The due date passes</p>
                      <p className="text-[14px] leading-6 text-muted">{noLateFee ? "No state late fee." : lateFeeText(first)}</p>
                    </div>
                  </li>
                  <li className="relative flex gap-3.5">
                    <span aria-hidden className="relative z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-danger/60 bg-danger-soft" />
                    <div className="grid gap-0.5">
                      <p className="font-semibold text-fg">Six months after the due date</p>
                      <p className="text-[14px] leading-6 text-muted">
                        The entity becomes subject to dissolution, cancellation or termination of its registration.
                      </p>
                    </div>
                  </li>
                  <li className="rounded-[var(--radius-control)] bg-warning-soft px-3.5 py-2.5 text-[13px] font-semibold text-warning">
                    Applies to reports due in {facts.enforcementStartsWithReportsDueIn} and later
                  </li>
                </ol>
              ) : null}
            </div>
          </GuideSection>

          {/* Have us file it */}
          <section
            aria-labelledby="cta-title"
            className="grid gap-8 overflow-hidden rounded-[28px] bg-accent p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] md:items-center md:gap-12"
          >
            <div className="grid content-start gap-5">
              <h2 id="cta-title" className="text-[30px] font-semibold leading-[1.08] text-accent-fg sm:text-[38px]">
                Have us file it
              </h2>
              <p className="max-w-[44ch] text-[16px] leading-7 text-accent-fg/85">
                Answer a short form, review everything, and authorize the filing. We prepare it, submit it to the {agency},
                and send you the state&apos;s confirmation.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code} variant="inverse">
                  Have us file it
                </FilingCtaLink>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-[15px] font-semibold text-accent-fg underline decoration-accent-fg/40 decoration-2 underline-offset-4 hover:decoration-accent-fg"
                >
                  Pricing for every entity type
                </Link>
              </div>
            </div>
            <Receipt
              title="If we file it for you"
              meta={exampleRule ? `Example: ${j.name} ${ENTITY_TYPE_LABELS[exampleRule.entityType]}` : `${j.name} annual report`}
              className="w-full md:rotate-[1.2deg]"
              footer={
                <span className="flex items-start gap-2">
                  <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  State fee verified against the {agency}
                  {reviewed ? `, ${verifiedText(reviewed)}` : ""}.
                </span>
              }
            >
              {exampleQuote && exampleRule ? (
                <PriceBreakdown quote={exampleQuote} stateName={j.name} totalLabel="Total if we file it" />
              ) : (
                <p className="text-sm leading-6 text-muted">
                  The state fee is {feeSummary(rules)}. Our service fee is shown as a separate line before you pay.
                </p>
              )}
            </Receipt>
          </section>
          <DisclaimerNote className="-mt-14 sm:-mt-16" stateName={j.name} filingUrl={first.officialFilingUrl} />

          {/* Required information */}
          <GuideSection
            id="required"
            title="What information is required"
            lede="The report confirms the business's current details. It doesn't include financial information."
          >
            <RequiredInfoSheet
              title={`${j.name} ${first.filingName.toLowerCase()}`}
              formNumber={first.formNumber}
              items={commonRequiredInfo(rules)}
            />
          </GuideSection>

          {/* How filing works */}
          <GuideSection id="how-to-file" title="How official filing works">
            <GuideText>
              <p>{first.filingMethodSummary}</p>
              <p>{first.processingSummary}</p>
            </GuideText>
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
                    <ArrowUpRight size={15} weight="bold" aria-hidden />
                    <span className="sr-only">(opens the official website in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </GuideSection>

          {/* Entity guides */}
          <GuideSection
            id="entity-guides"
            title="Guides by entity type"
            lede="Each guide covers the due date, the fee, who counts as a governor and what that entity type reports."
          >
            <ul className="grid gap-3 sm:grid-cols-2">
              {rules.map((r) => (
                <li key={r.ruleKey}>
                  <Link
                    href={`${path}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                    className="group flex min-h-[4.5rem] items-center gap-3.5 rounded-[var(--radius-surface)] border border-border bg-surface p-3 pr-4 transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-card"
                  >
                    <CalendarDate
                      month={r.dueRule.kind === "fixed_annual" ? r.dueRule.month : null}
                      day={r.dueRule.kind === "fixed_annual" ? r.dueRule.day : null}
                      size="sm"
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-semibold leading-snug text-fg group-hover:text-accent">
                        {j.name} {ENTITY_COPY[r.entityType].title}
                      </span>
                      <span className="tnum text-[13px] text-muted">Due {dueDayText(r)}</span>
                    </span>
                    <ArrowRight size={16} weight="bold" aria-hidden className="shrink-0 text-subtle group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </GuideSection>

          {/* FAQ */}
          <GuideSection id="faq" title="Questions">
            <FaqList items={faq} />
          </GuideSection>

          {/* Sources */}
          <GuideSection
            id="sources"
            title="Official sources"
            lede="Every fact on this page comes from these official publications. Each excerpt is what we checked it against."
          >
            <SourceList groups={sourceGroups} />
          </GuideSection>

          <div className="grid gap-4 border-t border-border pt-8">
            {reviewed ? (
              <p className="tnum text-sm text-muted">
                Last reviewed {verifiedText(reviewed)}. This page summarizes published requirements and is not legal advice.
              </p>
            ) : null}
            <DisclaimerNote stateName={j.name} filingUrl={first.officialFilingUrl} />
          </div>
        </div>

        <OnThisPageAside items={TOC} className="pt-4">
          <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code} size="md" className="w-full">
            Have us file it
          </FilingCtaLink>
          <p className="text-[13px] leading-5 text-muted">
            Or file it yourself at{" "}
            <a href={first.officialFilingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              {filingHost}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            for the state fee.
          </p>
        </OnThisPageAside>
      </Container>
    </>
  );
}

// ---------------------------------------------------------------------------
// Unverified state: honest directory page + waitlist
// ---------------------------------------------------------------------------

function UnverifiedState({ j }: { j: JurisdictionDef }) {
  const path = `/annual-report/${j.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Annual reports", path: "/annual-report" },
    { name: j.name, path },
  ];
  return (
    <>
      <PhotoHero
        id="state-title"
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`${j.name} annual report`}
        lede={
          <p>
            We haven&apos;t verified {j.name}&apos;s annual report requirements yet, so we don&apos;t show due dates or fees.
            For accurate information, go to the state&apos;s official business filing agency.
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
        waitlistLede={`We add a state only after checking its requirements against official sources. Leave your email and we'll let you know when ${j.name} is ready.`}
        links={[
          { href: "/annual-report", label: "All states" },
          { href: "/annual-report/pennsylvania", label: "Pennsylvania annual report (supported)" },
        ]}
      />
    </>
  );
}
