import { ArrowSquareOut, Info, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { RegistrySearch } from "@/components/funnel/registry-search";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { GuideSection, GuideText } from "@/components/marketing/guide-section";
import { JsonLd } from "@/components/marketing/json-ld";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import { verifiedText } from "@/lib/compliance/view";
import { daysBetween, formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import { dueDateForYear } from "@/lib/domain/deadlines";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getPaGuide, PA_GUIDES, PA_GUIDES_CHECKED, type GuideBlock } from "@/lib/seo/pa-guides";
import { searchRegistry, selectRegistryEntity } from "../../find/registry-actions";

export const dynamicParams = false;
// The deadline table counts days to each due date: refresh at least hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return PA_GUIDES.map((g) => ({ topic: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/pennsylvania/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  const g = getPaGuide(topic);
  if (!g) return {};
  return pageMetadata({ title: g.title, description: g.description, path: `/pennsylvania/${g.slug}` });
}

/** The three Pennsylvania due-date groups for this year, with a neutral "passed / days away" note. */
function DeadlineTable() {
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

export default async function PennsylvaniaGuidePage({ params }: PageProps<"/pennsylvania/[topic]">) {
  const { topic } = await params;
  const g = getPaGuide(topic);
  if (!g) notFound();
  const path = `/pennsylvania/${g.slug}`;
  const rule = findRule("PA", "llc");
  const quote = rule ? await publicQuote(rule) : null;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Pennsylvania annual report", path: "/annual-report/pennsylvania" },
    { name: g.h1.replace(/^Pennsylvania /, "").replace(/^\w/, (c) => c.toUpperCase()), path },
  ];

  const search = (
    <div className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
      <p className="font-display text-lg font-semibold text-fg">Find your Pennsylvania business</p>
      <p className="text-sm leading-6 text-muted">
        See when its annual report may be due and what it costs. No account needed, and we fill in what the public register
        shows.
      </p>
      <RegistrySearch search={searchRegistry} select={selectRegistryEntity} compact />
    </div>
  );

  return (
    <>
      <TrackView event="state_page_viewed" stateCode="PA" />
      <JsonLd
        data={graph(
          articleJsonLd({ headline: g.h1, description: g.description, path, dateModified: PA_GUIDES_CHECKED }),
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
              Checked against official Pennsylvania sources on {verifiedText(PA_GUIDES_CHECKED)}. {site.name} is a private filing
              service, not the Department of State.
            </span>
          </p>
        </header>

        {g.embedSearch ? <div className="max-w-[48rem]">{search}</div> : null}
        {g.slug === "annual-report-deadline" ? <div className="max-w-[48rem]"><DeadlineTable /></div> : null}

        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
          <div className="grid min-w-0 gap-12">
            {g.blocks.map((b, i) => (
              <Block key={b.heading} block={b} id={`s${i + 1}`} />
            ))}

            <GuideSection id="options" title="Your options">
              <GuideText>
                <p>
                  <strong className="text-fg">File it yourself.</strong> File online at{" "}
                  <a href={PENNSYLVANIA_FACTS.officialFilingUrl} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                    file.dos.pa.gov
                  </a>{" "}
                  for the state fee: {PENNSYLVANIA_FACTS.directFilingFeeText}. You don&apos;t need a filing service.
                </p>
                <p>
                  <strong className="text-fg">Get free reminders.</strong> Find your business and we&apos;ll email you before its next
                  due date. Nothing to buy.
                </p>
                <p>
                  <strong className="text-fg">Have {site.name} file it.</strong> We prefill what the public register shows, you check
                  and authorize, and we file it. Our service fee is separate from the state fee:
                </p>
              </GuideText>
              {quote ? (
                <div className="max-w-md rounded-[var(--radius-surface)] border border-border bg-surface p-5">
                  <PriceBreakdown quote={quote} stateName="Pennsylvania" totalLabel="Total if we file it" />
                </div>
              ) : null}
            </GuideSection>

            <GuideSection id="faq" title="Questions">
              <FaqList items={g.faq} />
            </GuideSection>

            <GuideSection id="sources" title="Official sources">
              <ul className="grid gap-2 text-[15px]">
                {g.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={`${textLinkClasses} inline-flex items-center gap-1.5`}>
                      {s.publisher}: {s.title}
                      <ArrowSquareOut size={14} aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">Last checked {verifiedText(PA_GUIDES_CHECKED)}.</p>
            </GuideSection>

            <nav aria-label="More Pennsylvania guides" className="grid gap-3 border-t border-border pt-8">
              <p className="text-sm font-semibold text-fg">More Pennsylvania guides</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
                <li>
                  <Link href="/annual-report/pennsylvania" className={textLinkClasses}>
                    Pennsylvania annual report
                  </Link>
                </li>
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
                {PA_GUIDES.filter((o) => o.slug !== g.slug).map((o) => (
                  <li key={o.slug}>
                    <Link href={`/pennsylvania/${o.slug}`} className={textLinkClasses}>
                      {o.h1.replace(/^Pennsylvania /, "").replace(/^\w/, (c) => c.toUpperCase())}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <aside className="grid gap-5 lg:sticky lg:top-[92px]">
            {g.embedSearch ? (
              <Link href="/find" className={buttonClasses("primary", "lg", "w-full")}>
                Find my business
              </Link>
            ) : (
              search
            )}
            <p className="flex gap-2 text-sm leading-6 text-muted">
              <Info size={18} aria-hidden className="mt-0.5 shrink-0" />
              {site.disclaimer} You can always file directly with Pennsylvania for the state fee alone.
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
