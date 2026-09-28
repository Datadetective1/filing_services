import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
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
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { SourceList } from "@/components/marketing/source-list";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { DirectoryListing } from "@/components/marketing/directory-listing";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/ui/table";
import { publicQuote } from "@/lib/compliance/public-quote";
import { getJurisdictionBySlug, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { ComplianceRuleDef, FaqItem, JurisdictionDef } from "@/lib/compliance/types";
import { lateFeeText, verifiedText } from "@/lib/compliance/view";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import {
  agencyShortName,
  commonRequiredInfo,
  dueDayText,
  dueSummary,
  dueTableRows,
  feeSummary,
  groupSources,
  latestVerified,
  sortByDue,
  stateFaq,
} from "@/lib/seo/content";
import { ENTITY_COPY, joinList } from "@/lib/seo/entities";
import { breadcrumbJsonLd, faqJsonLd, graph, serviceJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;
export const revalidate = 3600;

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
  const lateSentence = noLateFee ? "there is no state late fee" : "a state late fee applies";
  const firstReportYearAfter = rules.every((r) => r.firstDueRule.kind === "year_after_formation");

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

      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`${j.name} annual report`}
        lede={
          <p>
            Based on the {agency}&apos;s published requirements, most domestic and foreign entities registered in {j.name} must
            file an annual report every year: {dueSummary(rules)}. The state fee is{" "}
            {facts?.directFilingFeeText ?? feeSummary(rules)}, and {lateSentence}.
          </p>
        }
      >
        <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border sm:grid-cols-4">
          {[
            { term: "Due", value: [...new Set(sortByDue(rules).map((r) => dueDayText(r)))].join(", ") },
            { term: "State fee", value: facts?.directFilingFeeText ?? feeSummary(rules) },
            { term: "Late fee", value: noLateFee ? "None" : "Yes" },
            { term: "Form", value: first.formNumber ?? first.filingName },
          ].map((f) => (
            <div key={f.term} className="grid content-start gap-1 bg-surface px-4 py-3.5">
              <dt className="text-xs text-muted">{f.term}</dt>
              <dd className="tnum text-[15px] font-medium text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
      </PageIntro>

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
        <div className="grid min-w-0 gap-16 py-12 sm:py-16">
          {/* Due dates */}
          <section id="due-dates" aria-labelledby="due-dates-title" className="grid scroll-mt-24 gap-6">
            <SectionHeading
              id="due-dates-title"
              title="Due dates by entity type"
              lede={`The due date depends on the type of entity. The filing window opens January 1 of the report year.`}
            />
            <TableScroll>
              <Table>
                <THead>
                  <tr>
                    <TH>Entity type</TH>
                    <TH>Due</TH>
                    <TH>Filing window</TH>
                    <TH>State fee</TH>
                  </tr>
                </THead>
                <tbody>
                  {dueTableRows(rules).map((row) => (
                    <TR key={row.rule.ruleKey}>
                      <TD>
                        <Link
                          href={`${path}/${ENTITY_TYPE_SLUGS[row.rule.entityType]}`}
                          className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                        >
                          {row.label}
                        </Link>
                      </TD>
                      <TD className="tnum whitespace-nowrap">{row.due.replace(" each year", "")}</TD>
                      <TD className="tnum whitespace-nowrap">
                        <span className="text-muted">{row.window ?? "Varies"}</span>
                      </TD>
                      <TD className="tnum">{row.fee}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            {firstReportYearAfter ? (
              <p className="text-[15px] leading-7 text-muted">
                A business files its first report in the calendar year after it forms in {j.name} or first registers there as a
                foreign entity. A business formed this year has nothing to file until next year.
              </p>
            ) : null}
          </section>

          {/* Who must file */}
          <section id="who-files" aria-labelledby="who-files-title" className="grid scroll-mt-24 gap-5">
            <SectionHeading id="who-files-title" title="Who must file" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>
                Based on the {agency}&apos;s published requirements, every active domestic and foreign{" "}
                {joinList(rules.map((r) => ENTITY_COPY[r.entityType].singular))} registered with the {agency} files an annual
                report.
                {facts ? ` The requirement began in ${facts.firstRequiredYear}.` : null}
              </p>
              {facts ? (
                <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:p-5">
                  <p className="font-medium text-fg">Not required to file</p>
                  <p className="mt-1">{facts.exemptTypes}</p>
                </div>
              ) : null}
              {carNotes.length ? (
                <div>
                  <p className="font-medium text-fg">A separate filing some entities also make</p>
                  <ul className="mt-2 grid list-disc gap-1.5 pl-5">
                    {carNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">The annual report does not replace it.</p>
                </div>
              ) : null}
            </div>
          </section>

          {/* Fees */}
          <section id="fees" aria-labelledby="fees-title" className="grid scroll-mt-24 gap-5">
            <SectionHeading id="fees-title" title="State fees" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>
                Based on the {agency}&apos;s published requirements, the state fee is {feeSummary(rules)}. The fee is paid to the
                state when the report is filed. The table above lists the fee for each entity type.
              </p>
              <p>
                If you have us file it, we pass the state fee through at cost and show our service fee as a separate line before
                you pay.
              </p>
            </div>
          </section>

          {/* Late filing */}
          <section id="late" aria-labelledby="late-title" className="grid scroll-mt-24 gap-5">
            <SectionHeading id="late-title" title="Late fee and consequences" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>{lateFeeText(first)}</p>
              <p>{first.consequenceSummary}</p>
              {facts ? (
                <p className="rounded-[var(--radius-surface)] border border-border bg-surface p-4 font-medium text-fg sm:p-5">
                  Enforcement starts with reports due in {facts.enforcementStartsWithReportsDueIn}.
                </p>
              ) : null}
            </div>
          </section>

          {/* CTA */}
          <section aria-labelledby="cta-title" className="grid gap-6 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:gap-10">
            <div className="grid content-start gap-4">
              <h2 id="cta-title" className="text-2xl font-semibold tracking-tight text-fg">
                Have us file it
              </h2>
              <p className="text-[15px] leading-7 text-muted">
                Answer a short form, review everything, and authorize the filing. We prepare it, submit it to the {agency}, and
                send you the state&apos;s confirmation.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code}>
                  Have us file it
                </FilingCtaLink>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 px-2 text-[15px] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                >
                  Pricing for every entity type
                </Link>
              </div>
            </div>
            <div className="grid content-start gap-3 rounded-[var(--radius-control)] bg-surface-2 p-4 sm:p-5">
              {exampleQuote && exampleRule ? (
                <>
                  <p className="text-sm font-medium text-fg">
                    Example: {j.name} {ENTITY_TYPE_LABELS[exampleRule.entityType]}
                  </p>
                  <PriceBreakdown quote={exampleQuote} stateName={j.name} totalLabel="Total if we file it" />
                </>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  The state fee is {feeSummary(rules)}. Our service fee is shown as a separate line before you pay.
                </p>
              )}
            </div>
            <DisclaimerNote className="md:col-span-2" stateName={j.name} filingUrl={first.officialFilingUrl} />
          </section>

          {/* Required information */}
          <section id="required" aria-labelledby="required-title" className="grid scroll-mt-24 gap-5">
            <SectionHeading
              id="required-title"
              title="What information is required"
              lede="The report confirms the business's current details. It doesn't include financial information."
            />
            <ul className="grid max-w-[68ch] gap-3">
              {commonRequiredInfo(rules).map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-7 text-muted sm:text-base">
                  <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* How filing works */}
          <section id="how-to-file" aria-labelledby="how-title" className="grid scroll-mt-24 gap-5">
            <SectionHeading id="how-title" title="How official filing works" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
              <p>{first.filingMethodSummary}</p>
              <p>{first.processingSummary}</p>
            </div>
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {[
                { href: first.officialFilingUrl, label: "Official online filing" },
                { href: facts?.businessSearchUrl ?? j.agency.businessSearchUrl, label: "Official business search" },
                { href: first.officialInfoUrl, label: `${agency}: annual reports` },
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

          {/* Entity guides */}
          <section id="entity-guides" aria-labelledby="entity-title" className="grid scroll-mt-24 gap-6">
            <SectionHeading
              id="entity-title"
              title="Guides by entity type"
              lede="Each guide covers the due date, the fee, who counts as a governor and what that entity type reports."
            />
            <ul className="grid gap-2 sm:grid-cols-2">
              {rules.map((r) => (
                <li key={r.ruleKey}>
                  <Link
                    href={`${path}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                    className="group flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="text-[15px] font-medium text-fg">
                      {j.name} {ENTITY_COPY[r.entityType].title}
                    </span>
                    <ArrowRight size={16} aria-hidden className="shrink-0 text-subtle group-hover:text-fg" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section id="faq" aria-labelledby="faq-title" className="grid scroll-mt-24 gap-6">
            <SectionHeading id="faq-title" title="Questions" />
            <FaqList items={faq} />
          </section>

          {/* Sources */}
          <section id="sources" aria-labelledby="sources-title" className="grid scroll-mt-24 gap-6">
            <SectionHeading
              id="sources-title"
              title="Official sources"
              lede="Every fact on this page comes from these official publications. Each excerpt is what we checked it against."
            />
            <SourceList groups={sourceGroups} />
          </section>

          <div className="grid gap-4 border-t border-border pt-8">
            {reviewed ? (
              <p className="tnum text-sm text-muted">
                Last reviewed {verifiedText(reviewed)}. This page summarizes published requirements and is not legal advice.
              </p>
            ) : null}
            <DisclaimerNote stateName={j.name} filingUrl={first.officialFilingUrl} />
          </div>
        </div>

        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-8 grid gap-1 py-16 text-sm">
            <p className="mb-2 font-medium text-fg">On this page</p>
            {TOC.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="rounded-[var(--radius-control)] px-3 py-2 text-muted hover:bg-surface-2 hover:text-fg">
                {item.label}
              </a>
            ))}
            <div className="mt-6 border-t border-border pt-6">
              <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code} size="md" className="w-full">
                Have us file it
              </FilingCtaLink>
            </div>
          </nav>
        </aside>
      </div>
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
      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`${j.name} annual report`}
        lede={
          <p>
            We haven&apos;t verified {j.name}&apos;s annual report requirements yet, so we don&apos;t show due dates or fees. For
            accurate information, go to the state&apos;s official business filing agency.
          </p>
        }
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <DirectoryListing j={j} />
          <div className="grid content-start gap-5">
            <SectionHeading
              as="h2"
              title={`Get an email when we support ${j.name}`}
              lede={`We add a state only after checking its requirements against official sources. Leave your email and we'll let you know when ${j.name} is ready.`}
            />
            <WaitlistForm stateCode={j.code} stateName={j.name} />
          </div>
        </div>
        <div className="mt-14 grid gap-6 border-t border-border pt-8">
          <div className="flex flex-col gap-3 text-[15px] sm:flex-row sm:gap-8">
            <Link href="/annual-report" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-fg hover:underline hover:underline-offset-4">
              All states
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link
              href="/annual-report/pennsylvania"
              className="inline-flex min-h-11 items-center gap-1.5 font-medium text-fg hover:underline hover:underline-offset-4"
            >
              Pennsylvania annual report (supported)
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <DisclaimerNote />
        </div>
      </Section>
    </>
  );
}
