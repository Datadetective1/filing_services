import { ArrowSquareOut, Info, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { searchRegistry, selectRegistryEntity } from "@/app/(marketing)/find/registry-actions";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { RegistrySearch } from "@/components/funnel/registry-search";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { GuideSection, GuideText } from "@/components/marketing/guide-section";
import { JsonLd } from "@/components/marketing/json-ld";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { stateLookupEnabled } from "@/lib/compliance/launch";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule, getJurisdiction, isRuleSellable, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import { verifiedText } from "@/lib/compliance/view";
import { daysBetween, formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import { dueDateForYear } from "@/lib/domain/deadlines";
import { formatCents } from "@/lib/domain/money";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import type { GuideBlock } from "@/lib/seo/pa-guides";
import { guideSet } from "@/lib/seo/state-guides";

/**
 * Shared template for the supporting guide pages of every supported state
 * (/pennsylvania/<topic>, /washington/<topic>, /nevada/<topic>, /utah/<topic>).
 */

export function guideParams(stateCode: string) {
  return (guideSet(stateCode)?.guides ?? []).map((g) => ({ topic: g.slug }));
}

export function guideMetadata(stateCode: string, topic: string): Metadata {
  const set = guideSet(stateCode);
  const g = set?.guides.find((x) => x.slug === topic);
  if (!set || !g) return {};
  return pageMetadata({ title: g.title, description: g.description, path: `/${set.slug}/${g.slug}` });
}

const shortTitle = (h1: string, stateName: string) => h1.replace(new RegExp(`^${stateName} `), "").replace(/^\w/, (c) => c.toUpperCase());

/** Pennsylvania's three due-date groups for this year, with a neutral "passed / days away" note. */
function PaDeadlineTable() {
  const today = todayInTimeZone("America/New_York");
  const year = Number(today.slice(0, 4));
  const groups = [
    { label: "Corporations (business and nonprofit)", rule: findRule("PA", "corporation") },
    { label: "Limited liability companies (LLCs)", rule: findRule("PA", "llc") },
    { label: "LPs, LLPs, business trusts, professional associations and other associations", rule: findRule("PA", "lp") },
  ];
  return (
    <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
      <table className="w-full text-left text-[15px]">
        <caption className="sr-only">Pennsylvania annual report due dates for {year}</caption>
        <thead className="bg-surface-2 text-sm text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Entity type</th>
            <th scope="col" className="px-4 py-3 font-semibold sm:px-5">{year} due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map(({ label, rule }) => {
            const due = rule ? dueDateForYear(rule.dueRule, year) : null;
            const days = due ? daysBetween(today, due) : null;
            return (
              <tr key={label}>
                <td className="px-4 py-3 text-fg sm:px-5">{label}</td>
                <td className="tnum px-4 py-3 sm:px-5">
                  <span className="font-semibold text-fg">{due ? formatLongDate(due) : "—"}</span>
                  {days !== null ? (
                    <span className="block text-sm text-muted">
                      {days < 0 ? "Date has passed (it can still be filed)" : days === 0 ? "Today" : `${days} days away`}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, id }: { block: GuideBlock; id: string }) {
  const List = block.ordered ? "ol" : "ul";
  return (
    <GuideSection id={id} title={block.heading}>
      <GuideText>
        {block.paragraphs?.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
        {block.list ? (
          <List className={block.ordered ? "grid list-decimal gap-2 pl-6" : "grid list-disc gap-2 pl-6"}>
            {block.list.map((item) => (
              <li key={item.slice(0, 40)}>{item}</li>
            ))}
          </List>
        ) : null}
        {block.quote ? (
          <figure className="rounded-[var(--radius-surface)] border-l-4 border-accent bg-surface-2 px-5 py-4">
            <blockquote className="text-[15px] leading-7 text-fg">&ldquo;{block.quote.text}&rdquo;</blockquote>
            <figcaption className="mt-2 text-sm text-muted">
              <a href={block.quote.source.url} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                {block.quote.source.publisher}, {block.quote.source.title}
              </a>
            </figcaption>
          </figure>
        ) : null}
      </GuideText>
    </GuideSection>
  );
}

export async function StateGuidePage({ stateCode, topic }: { stateCode: string; topic: string }) {
  const set = guideSet(stateCode);
  const g = set?.guides.find((x) => x.slug === topic);
  if (!set || !g) notFound();
  const j = getJurisdiction(stateCode);
  const stateName = set.stateName;
  const path = `/${set.slug}/${g.slug}`;
  const isPa = stateCode === "PA";
  const rule = isPa ? findRule("PA", "llc") : rulesForState(stateCode).find((r) => r.entityType === "llc");
  const sellable = Boolean(rule && isRuleSellable(rule));
  const quote = rule && sellable ? await publicQuote(rule) : null;
  const lookupOn = stateLookupEnabled(stateCode);
  const hubName = j?.agency.periodicReportName ? `${stateName} ${j.agency.periodicReportName.toLowerCase()}` : `${stateName} annual report`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: isPa ? "Pennsylvania annual report" : hubName.replace(/^\w/, (c) => c.toUpperCase()), path: `/annual-report/${set.slug}` },
    { name: shortTitle(g.h1, stateName), path },
  ];
  const filingUrl = rule?.officialFilingUrl ?? j?.agency.websiteUrl ?? "";
  const filingHost = (() => {
    try {
      return new URL(filingUrl).host;
    } catch {
      return filingUrl;
    }
  })();
  const stateFeeText = isPa
    ? PENNSYLVANIA_FACTS.directFilingFeeText
    : rule?.feeComponents?.length
      ? `${rule.feeComponents.map((c) => `${formatCents(c.cents, { trimZeros: true })} ${c.label}`).join(" + ")} for an LLC`
      : rule
        ? `${formatCents(rule.stateFeeCents, { trimZeros: true })} for an LLC`
        : "";

  const search = isPa ? (
    <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
      <p className="font-display text-lg font-semibold text-fg">Find your Pennsylvania business</p>
      <p className="text-sm leading-6 text-muted">
        See when its annual report may be due and what it costs. No account needed, and we fill in what the public register
        shows.
      </p>
      <RegistrySearch search={searchRegistry} select={selectRegistryEntity} compact />
    </div>
  ) : lookupOn ? (
    <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
      <p className="font-display text-lg font-semibold text-fg">Check your {stateName} business</p>
      <p className="text-sm leading-6 text-muted">
        Enter a few details to see your due date and the state fees, and get a free reminder. No account needed.
      </p>
      <Link href={`/find?state=${stateCode}`} className={buttonClasses("primary", "md", "w-full")}>
        Find my business
      </Link>
    </div>
  ) : null;

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={stateCode} />
      <JsonLd
        data={graph(
          articleJsonLd({ headline: g.h1, description: g.description, path, dateModified: set.checked }),
          breadcrumbJsonLd(crumbs),
          faqJsonLd(g.faq),
        )}
      />
      <Container className="grid gap-12 pb-16 pt-8 sm:pt-12 lg:pb-24">
        <header className="grid max-w-[48rem] gap-5">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] text-fg text-balance sm:text-[52px]">{g.h1}</h1>
          <div className="grid gap-4 text-[17px] leading-8 text-fg sm:text-lg">
            {g.answer.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </div>
          <p className="flex items-start gap-2 text-sm leading-6 text-muted">
            <SealCheck size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <span>
              Checked against official {stateName} sources on {verifiedText(set.checked)}. {site.name} is a private filing service, not
              {isPa ? " the Department of State" : ` the ${j?.agency.name.split(" - ")[0] ?? "state"}`}.
            </span>
          </p>
        </header>

        {g.embedSearch && search ? <div className="max-w-[48rem]">{search}</div> : null}
        {isPa && g.slug === "annual-report-deadline" ? (
          <div className="max-w-[48rem]">
            <PaDeadlineTable />
          </div>
        ) : null}

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
          <div className="grid min-w-0 gap-12">
            {g.blocks.map((b, i) => (
              <Block key={b.heading} block={b} id={`s${i + 1}`} />
            ))}

            <GuideSection id="options" title="Your options">
              <GuideText>
                <p>
                  <strong className="text-fg">File it yourself.</strong> File online at{" "}
                  <a href={filingUrl} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                    {filingHost}
                  </a>{" "}
                  for the state {rule?.feeComponents?.length ? "fees" : "fee"}: {stateFeeText}. You don&apos;t need a filing service.
                </p>
                {isPa || lookupOn ? (
                  <p>
                    <strong className="text-fg">Get free reminders.</strong> Find your business and we&apos;ll email you before its
                    next due date. Nothing to buy.
                  </p>
                ) : null}
                {sellable ? (
                  <p>
                    <strong className="text-fg">Have {site.name} file it.</strong> We prefill what the public register shows, you
                    check and authorize, and we file it. Our service fee is separate from the state fee:
                  </p>
                ) : (
                  <p>
                    <strong className="text-fg">{site.name} filing for {stateName}</strong> isn&apos;t open yet. When it is, our service
                    fee will be shown separately from the state fees before you pay.
                  </p>
                )}
              </GuideText>
              {quote ? (
                <div className="max-w-md rounded-[var(--radius-surface)] border border-border bg-surface p-5">
                  <PriceBreakdown quote={quote} stateName={stateName} totalLabel="Total if we file it" />
                </div>
              ) : null}
            </GuideSection>

            <GuideSection id="faq" title="Questions">
              <FaqList items={g.faq} />
            </GuideSection>

            <GuideSection id="sources" title="Official sources">
              <ul className="grid gap-2 text-[15px]">
                {g.sources.map((s) => (
                  <li key={s.url + s.title}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${textLinkClasses} inline-flex items-center gap-1.5`}>
                      {s.publisher}: {s.title}
                      <ArrowSquareOut size={14} aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">Last checked {verifiedText(set.checked)}.</p>
            </GuideSection>

            <nav aria-label={`More ${stateName} guides`} className="grid gap-3 border-t border-border pt-8">
              <p className="text-sm font-semibold text-fg">More {stateName} guides</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
                <li>
                  <Link href={`/annual-report/${set.slug}`} className={textLinkClasses}>
                    {isPa ? "Pennsylvania annual report" : hubName.replace(/^\w/, (c) => c.toUpperCase())}
                  </Link>
                </li>
                {isPa ? (
                  <>
                    <li>
                      <Link href="/annual-report/pennsylvania/llc" className={textLinkClasses}>
                        LLC annual report
                      </Link>
                    </li>
                    <li>
                      <Link href="/annual-report/pennsylvania/corporation" className={textLinkClasses}>
                        Corporation annual report
                      </Link>
                    </li>
                  </>
                ) : null}
                {set.guides
                  .filter((o) => o.slug !== g.slug)
                  .map((o) => (
                    <li key={o.slug}>
                      <Link href={`/${set.slug}/${o.slug}`} className={textLinkClasses}>
                        {shortTitle(o.h1, stateName)}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </div>

          <aside className="grid gap-5 lg:sticky lg:top-[92px]">
            {g.embedSearch ? (
              <Link href={isPa ? "/find" : `/find?state=${stateCode}`} className={buttonClasses("primary", "lg", "w-full")}>
                Find my business
              </Link>
            ) : (
              search
            )}
            <p className="flex gap-2 text-sm leading-6 text-muted">
              <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
              {site.disclaimer} You can always file directly with {stateName} for the state {rule?.feeComponents?.length ? "fees" : "fee"}{" "}
              alone.
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
