import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/surface";
import { listJurisdictions } from "@/lib/compliance/registry";
import { formatCents } from "@/lib/domain/money";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled, formationOpenStates } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { formationNeeds, formationStateAnswer, formationStateFaq, formationStatePath, formationStateSnippet, leadType } from "@/lib/seo/formation-pages";
import { breadcrumbJsonLd, businessServiceJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

/** One page per state where formation can be ordered today, each fee from the state's own source. */
export function generateStaticParams() {
  return formationOpenStates().map((s) => ({ state: s.slug }));
}
export const dynamicParams = false;

function load(slug: string) {
  return formationOpenStates().find((s) => s.slug === slug) ?? null;
}

const money = (c: number) => formatCents(c, { trimZeros: true });

export async function generateMetadata(props: PageProps<"/business-formation/[state]">): Promise<Metadata> {
  const { state } = await props.params;
  const s = load(state);
  if (!s) return {};
  const prices = await publicServicePrices();
  return pageMetadata({
    ...formationStateSnippet(s, prices.formation),
    path: formationStatePath(s.slug),
    noindex: !businessServicesIndexable(),
  });
}

export default async function FormationStatePage(props: PageProps<"/business-formation/[state]">) {
  if (!businessServicesPagesEnabled()) notFound();
  const { state } = await props.params;
  const s = load(state);
  if (!s) notFound();
  const j = getRaJurisdiction(s.code);
  const prices = await publicServicePrices();
  const service = prices.formation;
  const ra = prices.registered_agent;
  const t = leadType(s);
  const typeWord = t === "llc" ? "LLC" : "corporation";
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Business formation", path: "/business-formation" },
    { name: s.name, path: formationStatePath(s.slug) },
  ];
  const faq = formationStateFaq(s, { serviceCents: service, raCents: ra });
  const sources = (j?.formation?.sources ?? []).filter((x, k, all) => all.findIndex((y) => y.publisher === x.publisher) === k);
  const checked = [...new Set((j?.formation?.sources ?? []).map((x) => x.checkedAt))].sort().pop();
  const hasReportGuide = listJurisdictions().some((x) => x.code === s.code);
  const others = formationOpenStates().filter((x) => x.code !== s.code);
  const costs = [
    ...(s.feeCents.llc !== undefined ? [{ term: `${s.name} LLC state fee`, value: money(s.feeCents.llc) }] : []),
    ...(s.feeCents.corporation !== undefined ? [{ term: `${s.name} corporation state fee`, value: money(s.feeCents.corporation) }] : []),
    ...(service !== undefined ? [{ term: "Filewell filing service", value: money(service) }] : []),
    ...(ra !== undefined ? [{ term: "Registered agent (optional)", value: `${money(ra)} a year` }] : []),
  ];

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          businessServiceJsonLd({
            name: `${s.name} ${typeWord} formation`,
            serviceType: "LLC and corporation formation filing",
            description: `We file your ${s.name} ${typeWord} with the state for one service fee plus the state's own fee, each shown on its own line.`,
            path: formationStatePath(s.slug),
            stateName: s.name,
            offer:
              service !== undefined
                ? {
                    name: `${s.name} ${typeWord} formation`,
                    priceCents: service + (s.feeCents[t] as number),
                    description: `${money(service)} Filewell service fee plus the ${money(s.feeCents[t] as number)} ${s.name} state fee.`,
                  }
                : undefined,
          }),
          faqJsonLd(faq),
        )}
      />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`Start ${t === "llc" ? "an LLC" : "a corporation"} in ${s.name}`}
        lede={<p>{formationStateAnswer(s, service)}</p>}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-8">
            <div className="grid gap-4">
              <SectionHeading title={`What it costs in ${s.name}`} />
              <dl className="grid gap-3 sm:grid-cols-2">
                {costs.map((c) => (
                  <div key={c.term} className="rounded-[var(--radius-control)] border border-border bg-surface p-4">
                    <dt className="text-sm text-muted">{c.term}</dt>
                    <dd className="tnum mt-1 text-lg font-semibold text-fg">{c.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[15px] leading-7 text-muted">The state fee is passed through at cost. We add nothing to it.</p>
            </div>

            <div className="grid gap-4">
              <SectionHeading title="What you'll need" />
              <ul className="grid gap-2 text-[15px] leading-7 text-muted">
                {formationNeeds(s).map((n) => (
                  <li key={n} className="flex gap-2">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    {n}
                  </li>
                ))}
              </ul>
              {j?.appointmentProcess ? <p className="text-[15px] leading-7 text-muted">{j.appointmentProcess}</p> : null}
            </div>

            <div className="grid gap-4">
              <SectionHeading title="After you form" />
              <p className="text-[15px] leading-7 text-muted">
                Your {s.name} {typeWord} will have ongoing state filings.{" "}
                {hasReportGuide ? (
                  <>
                    The{" "}
                    <Link href={`/annual-report/${s.slug}`} className={textLinkClasses}>
                      {s.name} annual report guide
                    </Link>{" "}
                    shows what&apos;s due and when, and we can remind you for free.
                  </>
                ) : (
                  "We can remind you before each one is due."
                )}
              </p>
            </div>

            {sources.length ? (
              <div className="grid gap-2">
                <h3 className="font-semibold text-fg">Fees checked against{checked ? ` (${checked})` : ""}</h3>
                <ul className="grid gap-1 text-sm text-muted">
                  {sources.map((x) => (
                    <li key={x.publisher}>{x.publisher}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Notice tone="neutral">
              <p>Filewell is a private company and is not affiliated with the state. We are not a law firm and don&apos;t give legal advice.</p>
            </Notice>
          </div>

          <div className="grid content-start gap-4">
            <Card className="grid content-start gap-3 p-5">
              <h2 className="text-lg font-semibold text-fg">Ready to start?</h2>
              <p className="text-[15px] text-muted">About five minutes. You see the full price, each fee on its own line, before you pay.</p>
              <Link href={`/dashboard/services/formation?state=${s.code}&type=${t}`} prefetch={false} className={buttonClasses("primary", "md")}>
                Start my {s.name} {typeWord}
              </Link>
            </Card>
            {ra !== undefined && j?.changeOfAgent ? (
              <Card className="grid content-start gap-3 p-5">
                <h2 className="text-lg font-semibold text-fg">Need a {s.name} registered agent?</h2>
                <p className="text-[15px] text-muted">{money(ra)} a year, the same at renewal. Add it when you form, or later.</p>
                <Link href={`/registered-agent/${s.slug}`} className={textLinkClasses}>
                  {s.name} registered agent service
                </Link>
              </Card>
            ) : null}
          </div>
        </div>
      </Section>
      <Section band>
        <SectionHeading title={`Forming a business in ${s.name}: questions`} />
        <FaqList items={faq} className="mt-8" />
      </Section>
      {others.length ? (
        <Section>
          <nav aria-label="Business formation in other states" className="grid gap-4">
            <h2 className="text-xl font-semibold text-fg">Start a business in another state</h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-3 lg:grid-cols-4">
              {others.map((o) => (
                <li key={o.code}>
                  <Link href={formationStatePath(o.slug)} className={textLinkClasses}>
                    {o.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Section>
      ) : null}
    </>
  );
}
