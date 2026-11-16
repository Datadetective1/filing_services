import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { site } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable } from "@/lib/registered-agent/sales";
import { checkedLabel, comparePath, COMPETITORS, competitorBySlugPath, fiveYearCents, type CompetitorFacts } from "@/lib/seo/compare";
import { filewellFacts } from "@/lib/seo/compare-filewell";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: `filewell-vs-${c.slug}` }));
}

export async function generateMetadata({ params }: PageProps<"/compare/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = competitorBySlugPath(slug);
  if (!c) return {};
  const f = await filewellFacts();
  return pageMetadata({
    title: `Filewell vs ${c.name}: Registered Agent and Annual Report Prices`,
    description: f
      ? `Registered agent ${formatCents(f.raCents, { trimZeros: true })} a year at Filewell, ${c.raFirstYear} the first year at ${c.name}. Annual reports, renewals and switching, side by side.`
      : `Filewell and ${c.name} side by side: registered agent, renewals, annual reports and switching.`,
    path: comparePath(c),
    absoluteTitle: true,
    noindex: !f || !businessServicesIndexable(),
  });
}

/** "LegalZoom, ZenBusiness and Northwest Registered Agent". */
function trademarkLine(): string {
  const names = COMPETITORS.map((x) => x.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

function money(cents: number) {
  return formatCents(cents, { trimZeros: true });
}

/** Two horizontal bars: two years of registered agent service, before any state fee. */
function TwoYearBars({ ours, c }: { ours: number; c: CompetitorFacts }) {
  const max = Math.max(ours, c.raTwoYearCents);
  const rows = [
    { name: site.name, cents: ours, tone: "bg-accent", note: "same price at renewal" },
    { name: c.name, cents: c.raTwoYearCents, tone: "bg-fg/25", note: c.raTwoYearNote },
  ];
  return (
    <figure className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8">
      <figcaption className="text-sm font-semibold text-muted">Registered agent, first two years</figcaption>
      {rows.map((r) => (
        <div key={r.name} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[15px] font-semibold text-fg">{r.name}</span>
            <span className="tnum font-display text-2xl font-semibold text-fg">
              {money(r.cents)}
              {r.note ? <span className="ml-1.5 text-sm font-normal text-muted">{r.note}</span> : null}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${r.tone}`} style={{ width: `${Math.max(6, Math.round((r.cents / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </figure>
  );
}

export default async function ComparePage({ params }: PageProps<"/compare/[slug]">) {
  const { slug } = await params;
  const c = competitorBySlugPath(slug);
  if (!c) notFound();
  const f = await filewellFacts();
  if (!f) notFound();

  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/compare" },
    { name: `Filewell vs ${c.name}`, path: comparePath(c) },
  ];
  const ours = money(f.raCents);
  const twoYearOurs = f.raCents * 2;
  const saving = c.raTwoYearCents - twoYearOurs;
  const rows: { label: string; ours: string; theirs: string }[] = [
    { label: "Registered agent, first year", ours, theirs: c.raFirstYear },
    { label: "Registered agent, each renewal", ours: `${ours}, same as the first year`, theirs: c.raRenewal },
    {
      label: "Registered agent, five years",
      ours: money(f.raCents * 5),
      theirs: `${money(fiveYearCents(c))}${c.raTwoYearNote ? ` ${c.raTwoYearNote}` : ""}, at the renewal price listed today`,
    },
    { label: "Switching from another agent", ours: "State fee only, our filing included", theirs: c.switching },
    { label: "Annual report filing", ours: f.report, theirs: c.report },
  ];
  const others = COMPETITORS.filter((x) => x.slug !== c.slug);

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(crumbs))} />

      <section aria-labelledby="compare-title" className="border-b border-border">
        <Container className="grid gap-10 pb-14 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pb-20">
          <div className="grid min-w-0 content-start gap-6">
            <Breadcrumbs items={crumbs} />
            <h1 id="compare-title" className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
              {site.name} vs <span className="mark-highlight">{c.name}</span>
            </h1>
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              {saving > 0
                ? `Registered agent for ${ours} a year, the same every year. Over two years that's ${money(saving)} less than ${c.name}'s listed prices.`
                : `Registered agent for ${ours} a year, the same every year. Here's how the two compare, price by price.`}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/registered-agent/start" prefetch={false} className={buttonClasses("primary", "md")}>
                Get a registered agent
              </Link>
              <Link href="/find" prefetch={false} className={buttonClasses("secondary", "md")}>
                Check my annual report
              </Link>
            </div>
          </div>
          <TwoYearBars ours={twoYearOurs} c={c} />
        </Container>
      </section>

      <section aria-labelledby="table-title" className="py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="table-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Side by side
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
            <table className="w-full text-left text-[15px]">
              <thead className="bg-surface-2 text-sm text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-7">
                    <span className="sr-only">Service</span>
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold text-fg sm:px-7">
                    {site.name}
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-7">
                    {c.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.label} className="align-top">
                    <th scope="row" className="px-5 py-4 font-semibold text-fg sm:px-7">
                      {r.label}
                    </th>
                    <td className="px-5 py-4 text-fg sm:px-7">{r.ours}</td>
                    <td className="px-5 py-4 text-muted sm:px-7">{r.theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-[70ch] text-sm leading-6 text-subtle">
            {c.name}&apos;s prices as listed on its own website on {checkedLabel()} ({c.sources.join("; ")}). They may have changed since. State
            fees are set by each state and passed through at cost.
          </p>
        </Container>
      </section>

      <section aria-labelledby="fair-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="grid content-start gap-4">
            <h2 id="fair-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              To be fair
            </h2>
            <p className="text-[17px] leading-relaxed text-muted">What {c.name} offers that we don&apos;t, or does differently.</p>
            <ul className="grid gap-3">
              {c.theyInclude.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-6 text-fg">
                  <Check size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-muted" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-4">
            <h2 className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">Why people pick {site.name}</h2>
            <ul className="grid gap-3">
              {[
                `One price, ${ours} a year, that doesn't jump at renewal.`,
                "Find your business on the state's register and we fill in the order for you.",
                "Legal documents and state notices scanned to your dashboard and your inbox.",
                `Annual reports from ${money(f.reportFromCents)} plus the state fee, in ${f.reportStates} ${f.reportStates === 1 ? "state" : "states"}.`,
              ].map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-6 text-fg">
                  <Check size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="py-14 sm:py-20">
        <Container className="grid gap-6">
          <p className="text-sm font-semibold text-fg">More comparisons</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {others.map((x) => (
              <li key={x.slug}>
                <Link href={comparePath(x)} className={textLinkClasses}>
                  {site.name} vs {x.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="max-w-[70ch] text-[13px] leading-6 text-subtle">
            {trademarkLine()} are trademarks of their owners. {site.name} isn&apos;t affiliated with or
            endorsed by them.
          </p>
          <Link href="/registered-agent" className="inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-accent">
            See how our registered agent works
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </Container>
      </section>
    </>
  );
}
