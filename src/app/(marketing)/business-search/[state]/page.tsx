import { ArrowRight, Database, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { RegistrySearch } from "@/components/funnel/registry-search";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { SearchTileMap } from "@/components/visual/search-tile-map";
import { site } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import {
  businessSearchDescription,
  businessSearchFaq,
  businessSearchPageStates,
  businessSearchStateBySlug,
  businessSearchStates,
  businessSearchTitle,
} from "@/lib/seo/business-search";
import { breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { stateServices } from "@/lib/services/state-services";
import { searchRegistry, selectRegistryEntity } from "../../find/registry-actions";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return businessSearchPageStates().map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: PageProps<"/business-search/[state]">): Promise<Metadata> {
  const { state } = await params;
  const s = businessSearchStateBySlug(state);
  if (!s) return {};
  return pageMetadata({ title: businessSearchTitle(s), description: businessSearchDescription(s), path: s.path, absoluteTitle: true });
}

export default async function BusinessSearchStatePage({ params }: PageProps<"/business-search/[state]">) {
  const { state } = await params;
  const s = businessSearchStateBySlug(state);
  if (!s) notFound();

  const faq = businessSearchFaq(s);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Business search", path: "/business-search" },
    { name: s.name, path: s.path },
  ];
  // Only what can be bought for a business that already exists: formation is for new ones.
  const view = businessServicesPagesEnabled() ? await stateServices(s.code) : null;
  const offers = (view?.offered ?? []).filter((o) => o.key !== "formation");
  const all = businessSearchStates();
  const links = Object.fromEntries(all.map((x) => [x.code, x.path]));

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(crumbs), faqJsonLd(faq))} />

      <section aria-labelledby="search-title" className="overflow-hidden border-b border-border">
        <Container className="grid gap-10 pb-14 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pb-20">
          <div className="grid min-w-0 content-start gap-6">
            <Breadcrumbs items={crumbs} />
            <div className="grid gap-3">
              <h1 id="search-title" className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
                {s.name} business <span className="mark-highlight">search</span>
              </h1>
              <p className="max-w-[46ch] text-[17px] leading-relaxed text-muted sm:text-lg">
                Look up any {s.name} LLC or corporation by name or {s.source.numberLabel}. Free, live from the state&apos;s own
                register, no account needed.
              </p>
            </div>
            <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7">
              <RegistrySearch search={searchRegistry} select={selectRegistryEntity} stateCode={s.code} compact />
            </div>
            <p className="max-w-[62ch] text-sm leading-6 text-subtle">
              Source: {s.source.source}. {s.source.caveat} {site.name} is a private service, not a state agency.
            </p>
          </div>
          <div className="relative grid gap-4 max-lg:order-first max-lg:mx-auto max-lg:w-full max-lg:max-w-md">
            <SearchTileMap links={links} active={s.code} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="steps-title" className="py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="steps-title" className="max-w-2xl text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Found it? The paperwork is half done.
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: <MagnifyingGlass size={22} weight="bold" aria-hidden />, title: "Search", body: `Name or ${s.source.numberLabel}. Pick the right business from the list.` },
              { icon: <Database size={22} weight="bold" aria-hidden />, title: "See what's on record", body: "Entity type, formation date and address, and what it may need to file next." },
              { icon: <ShieldCheck size={22} weight="bold" aria-hidden />, title: "We fill in the rest", body: "Order with us and the register's details are already in the form. You check, we file." },
            ].map((step, i) => (
              <li key={step.title} className="grid content-start gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card">
                <span className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-highlight-soft text-highlight-fg">{step.icon}</span>
                  <span className="text-sm font-semibold text-subtle">Step {i + 1}</span>
                </span>
                <h3 className="text-lg font-semibold text-fg">{step.title}</h3>
                <p className="text-[15px] leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {offers.length > 0 && view ? (
        <section aria-labelledby="offers-title" className="grain bg-surface-2 py-14 sm:py-20">
          <Container className="grid gap-8">
            <h2 id="offers-title" className="max-w-2xl text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              What we handle in {s.name}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const from = Math.min(...o.options.map((x) => x.totalCents));
                return (
                  <li key={o.key} className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card">
                    <h3 className="text-[19px] font-semibold text-fg">{o.title}</h3>
                    <p className="flex flex-wrap items-baseline gap-x-1.5">
                      {o.options.length > 1 ? <span className="text-sm text-muted">From</span> : null}
                      <span className="tnum font-display text-[38px] font-semibold leading-none tracking-tight text-fg">
                        {formatCents(from, { trimZeros: true })}
                      </span>
                      <span className="text-sm text-muted">{o.cadence}</span>
                    </p>
                    <p className="flex-1 text-[15px] leading-6 text-muted">{o.blurb}</p>
                  </li>
                );
              })}
            </ul>
            <Link href={`/services/${view.slug}`} className={buttonClasses("secondary", "md", "w-fit")}>
              Every {s.name} service and price
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="faq-title" className="py-14 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <div className="grid content-start gap-5">
            <h2 id="faq-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Questions
            </h2>
            <nav aria-label="Business search in other states" className="grid gap-2">
              <p className="text-sm font-semibold text-fg">Search another state</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {all
                  .filter((x) => x.code !== s.code)
                  .map((x) => (
                    <li key={x.code}>
                      <Link href={x.path} className={textLinkClasses}>
                        {x.name}
                      </Link>
                    </li>
                  ))}
              </ul>
            </nav>
          </div>
          <FaqList items={faq} />
        </Container>
      </section>
    </>
  );
}
