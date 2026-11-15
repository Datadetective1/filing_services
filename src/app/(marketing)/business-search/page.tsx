import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { RegistrySearch } from "@/components/funnel/registry-search";
import { Container } from "@/components/ui/surface";
import { SearchTileMap } from "@/components/visual/search-tile-map";
import { businessSearchStates } from "@/lib/seo/business-search";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { searchRegistry, selectRegistryEntity } from "../find/registry-actions";

export const revalidate = 3600;

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Business search", path: "/business-search" },
];

export function generateMetadata(): Metadata {
  const names = businessSearchStates().map((s) => s.name);
  return pageMetadata({
    title: "Free Business Search: Look Up an LLC or Corporation by State",
    description: `Search official business registers in ${names.join(", ")}: entity type, formation date and address on record. Free, no account needed.`,
    path: "/business-search",
    absoluteTitle: true,
  });
}

export default function BusinessSearchHubPage() {
  const states = businessSearchStates();
  const links = Object.fromEntries(states.map((s) => [s.code, s.path]));

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <section aria-labelledby="hub-title" className="overflow-hidden">
        <Container className="grid gap-10 pb-16 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pb-24">
          <div className="grid min-w-0 content-start gap-6">
            <Breadcrumbs items={CRUMBS} />
            <div className="grid gap-3">
              <h1 id="hub-title" className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
                Look up any <span className="mark-highlight">business</span>.
              </h1>
              <p className="max-w-[46ch] text-[17px] leading-relaxed text-muted sm:text-lg">
                Live searches of {states.length} state business registers. Pick a state, type a name, and see what&apos;s on record.
                Free, no account needed.
              </p>
            </div>
            <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7">
              <RegistrySearch
                search={searchRegistry}
                select={selectRegistryEntity}
                states={states.map((s) => ({ code: s.code, name: s.name }))}
                stateCode=""
              />
            </div>
          </div>
          <div className="grid gap-6 max-lg:mx-auto max-lg:w-full max-lg:max-w-md">
            <SearchTileMap links={links} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="states-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="states-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Search by state
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {states.map((s) => (
              <li key={s.code}>
                <Link
                  href={s.path}
                  className="group flex items-center justify-between gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="grid gap-1">
                    <span className="text-lg font-semibold text-fg">{s.name} business search</span>
                    <span className="text-sm text-muted">By name or {s.source.numberLabel}</span>
                  </span>
                  <ArrowRight size={18} weight="bold" aria-hidden className="shrink-0 text-accent transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-[15px] text-muted">
            Business in another state? <Link href="/find" className="font-semibold text-accent underline underline-offset-4">Enter its details</Link> and
            we&apos;ll show what it needs to file and when.
          </p>
        </Container>
      </section>
    </>
  );
}
