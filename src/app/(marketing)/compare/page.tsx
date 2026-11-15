import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { Container } from "@/components/ui/surface";
import { site } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable } from "@/lib/registered-agent/sales";
import { checkedLabel, comparePath, COMPETITORS } from "@/lib/seo/compare";
import { filewellFacts } from "@/lib/seo/compare-filewell";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Compare", path: "/compare" },
];

export async function generateMetadata(): Promise<Metadata> {
  const f = await filewellFacts();
  return pageMetadata({
    title: "Filewell vs LegalZoom, ZenBusiness and Northwest: Price Comparison",
    description: "Registered agent and annual report prices side by side, read from each company's own website.",
    path: "/compare",
    absoluteTitle: true,
    noindex: !f || !businessServicesIndexable(),
  });
}

export default async function CompareHubPage() {
  const f = await filewellFacts();
  if (!f) notFound();
  const max = Math.max(f.raCents * 2, ...COMPETITORS.map((c) => c.raTwoYearCents));
  const bars = [
    { name: site.name, cents: f.raCents * 2, path: null as string | null, ours: true },
    ...COMPETITORS.map((c) => ({ name: c.name, cents: c.raTwoYearCents, path: comparePath(c), ours: false })),
  ].sort((a, b) => a.cents - b.cents);

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <section aria-labelledby="hub-title" className="py-10 sm:py-16">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-14">
          <div className="grid content-start gap-5">
            <Breadcrumbs items={CRUMBS} />
            <h1 id="hub-title" className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
              How we <span className="mark-highlight">compare</span>
            </h1>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              Registered agent for {formatCents(f.raCents, { trimZeros: true })} a year, the same at renewal. Here&apos;s two years of it next to the
              best-known names.
            </p>
          </div>
          <figure className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8">
            <figcaption className="text-sm font-semibold text-muted">Registered agent, first two years, before state fees</figcaption>
            {bars.map((b) => (
              <div key={b.name} className="grid gap-2">
                <div className="flex items-baseline justify-between gap-4">
                  {b.path ? (
                    <Link href={b.path} className="text-[15px] font-semibold text-fg underline-offset-4 hover:underline">
                      {b.name}
                    </Link>
                  ) : (
                    <span className="text-[15px] font-semibold text-fg">{b.name}</span>
                  )}
                  <span className="tnum font-display text-xl font-semibold text-fg">{formatCents(b.cents, { trimZeros: true })}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${b.ours ? "bg-accent" : "bg-fg/25"}`}
                    style={{ width: `${Math.max(6, Math.round((b.cents / max) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[13px] leading-5 text-subtle">
              Their prices as listed on their own websites on {checkedLabel()}. They may have changed. ZenBusiness adds state fees in the
              first year.
            </p>
          </figure>
        </Container>
      </section>
      <section className="grain bg-surface-2 py-14 sm:py-20">
        <Container>
          <ul className="grid gap-3 sm:grid-cols-3">
            {COMPETITORS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={comparePath(c)}
                  className="group flex h-full items-center justify-between gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="text-lg font-semibold text-fg">
                    {site.name} vs {c.name}
                  </span>
                  <ArrowRight size={18} weight="bold" aria-hidden className="shrink-0 text-accent transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
