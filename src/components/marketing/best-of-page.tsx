import { ArrowRight, Check, Info } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { site } from "@/config/site";
import type { FaqItem } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable } from "@/lib/registered-agent/sales";
import { annualReportRows, BEST_OF_PATHS, BEST_OF_YEAR, cheapest, registeredAgentRows, type BestOfKind, type BestOfRow, type FilewellSide } from "@/lib/seo/best-of";
import { checkedLabel, COMPARE_CHECKED, COMPETITORS } from "@/lib/seo/compare";
import { filewellFacts } from "@/lib/seo/compare-filewell";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { annualReportPlaces } from "@/lib/services/state-services";

const money = (c: number) => formatCents(c, { trimZeros: true });

const COPY: Record<BestOfKind, { h1: string; title: string; crumb: string; columns: string[]; barCaption: string }> = {
  "annual-report": {
    h1: "Best annual report filing services",
    title: `Best Annual Report Filing Services (${BEST_OF_YEAR}): Prices Compared`,
    crumb: "Best annual report filing services",
    columns: ["Service fee", "State fee", "What you get"],
    barCaption: "Annual report service fee, before the state's fee",
  },
  "registered-agent": {
    h1: "Best registered agent services",
    title: `Best Registered Agent Services (${BEST_OF_YEAR}): Prices Compared`,
    crumb: "Best registered agent services",
    columns: ["First year", "Each renewal", "Two years"],
    barCaption: "Registered agent, first two years, before state fees",
  },
};

async function filewellSide(): Promise<FilewellSide | null> {
  const f = await filewellFacts();
  if (!f) return null;
  const places = await annualReportPlaces().catch(() => []);
  const by = new Map<number, number>();
  for (const p of places) by.set(p.serviceCents, (by.get(p.serviceCents) ?? 0) + 1);
  const reportTiers = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([serviceCents, states]) => ({ serviceCents, states }));
  if (reportTiers.length === 0) reportTiers.push({ serviceCents: f.reportFromCents, states: f.reportStates });
  return { raCents: f.raCents, reportTiers };
}

function names(list: string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list.join("");
}

/** The direct answer, first thing on the page. Built from the same rows as the table. */
function answer(kind: BestOfKind, f: FilewellSide, rows: BestOfRow[]): string[] {
  const low = cheapest(rows);
  if (kind === "annual-report") {
    const lowTier = f.reportTiers[0];
    const highTier = f.reportTiers.length > 1 ? f.reportTiers[f.reportTiers.length - 1] : null;
    const at99 = COMPETITORS.filter((c) => c.reportCents !== undefined && c.reportCents <= 10000).map((c) => `${c.name} (${money(c.reportCents as number)})`);
    const dear = COMPETITORS.filter((c) => c.reportCents !== undefined && c.reportCents > 10000).map((c) => `${c.name} lists ${money(c.reportCents as number)} per state`);
    return [
      `${site.name} has the lowest listed service fee of the six: ${money(lowTier.serviceCents)} plus the state fee, in the ${lowTier.states === 1 ? "state" : `${lowTier.states} states`} where we file ourselves.${
        highTier ? ` In ${f.reportTiers.slice(1).reduce((n, t) => n + t.states, 0)} more states we charge ${money(highTier.serviceCents)}, about the same as ${names(at99)}.` : ""
      }${dear.length ? ` ${names(dear)}.` : ""}`,
      "Every price here is before the state's own fee, which each state sets. You can also file the report yourself and pay only the state fee.",
    ];
  }
  const firstYear = COMPETITORS.map((c) => ({ name: c.name, cents: c.raTwoYearCents - c.raRenewalCents, renew: c.raRenewalCents }));
  const minFirst = Math.min(...firstYear.map((x) => x.cents));
  const lowFirst = firstYear.filter((x) => x.cents === minFirst);
  return [
    low
      ? `Over two years, ${low.names} costs the least of the six at ${money(low.cents)}${low.names === site.name ? `: ${money(f.raCents)} a year, the same at renewal` : ""}.`
      : "",
    minFirst < f.raCents
      ? `The lowest first year is ${names(lowFirst.map((x) => x.name))} at ${money(minFirst)}, but ${lowFirst.length > 1 ? "they renew" : "it renews"} at ${names(lowFirst.map((x) => money(x.renew)))}.`
      : "",
    "You can also be your own registered agent for free, if you're happy to have your address on the public record and be there during business hours.",
  ].filter(Boolean);
}

function faq(kind: BestOfKind, f: FilewellSide, rows: BestOfRow[]): FaqItem[] {
  const low = cheapest(rows);
  if (kind === "annual-report") {
    const lowTier = f.reportTiers[0];
    return [
      {
        q: "What's the cheapest annual report filing service?",
        a: `Of the six services we compared, ${site.name} lists the lowest service fee: ${money(lowTier.serviceCents)} plus the state fee in the ${lowTier.states} states where we file ourselves. Filing it yourself costs only the state fee.`,
      },
      {
        q: "Do I need a service to file my annual report?",
        a: "No. Every state lets a business file its own annual report. A service is worth it if you want reminders before it's due, someone to check it before it goes in, and help if the state sends it back.",
      },
      {
        q: "Is the state fee included in these prices?",
        a: "No. Every price in the table is the company's own fee. The state's fee is added on top. At Filewell it's passed through at cost and shown as its own line before you pay.",
      },
      {
        q: "How did you pick these services?",
        a: `They're the names that come up most when people ask for an annual report service. We read each one's price on its own website on ${checkedLabel()}. ${site.name} is our own service, so we've listed what the others do better too.`,
      },
    ];
  }
  return [
    {
      q: "What's the cheapest registered agent service?",
      a: low
        ? `Over two years, ${low.names} at ${money(low.cents)}, of the six we compared. Some services start lower and raise the price at renewal, so compare at least two years.`
        : "Compare at least two years: some services start lower and raise the price at renewal.",
    },
    {
      q: "Does the price go up after the first year?",
      a: `At some services, yes. ${COMPETITORS.filter((c) => c.raRenewalCents > c.raTwoYearCents - c.raRenewalCents)
        .map((c) => `${c.name} goes from ${money(c.raTwoYearCents - c.raRenewalCents)} to ${money(c.raRenewalCents)}`)
        .join("; ")}. ${site.name} is ${money(f.raCents)} every year.`,
    },
    {
      q: "Can I be my own registered agent?",
      a: "Yes, if you have a street address in the state and are there during business hours. Your address goes on the public record, which is why many owners use a service.",
    },
    {
      q: "What does it cost to switch registered agents?",
      a: `At ${site.name}, only the state's fee for the change: our filing is included. Other services' switching costs are in the table on each one-on-one comparison.`,
    },
  ];
}

export async function bestOfMetadata(kind: BestOfKind): Promise<Metadata> {
  const f = await filewellSide();
  const c = COPY[kind];
  const description =
    kind === "annual-report"
      ? `Annual report filing prices from Filewell, LegalZoom, ZenBusiness, Northwest, Bizee and Harbor Compliance, read on each company's own site. State fees shown separately.`
      : `Registered agent prices from Filewell, LegalZoom, ZenBusiness, Northwest, Bizee and Harbor Compliance: first year, renewal and two-year total, from each company's own site.`;
  return pageMetadata({ title: c.title, description, path: BEST_OF_PATHS[kind], absoluteTitle: true, noindex: !f || !businessServicesIndexable() });
}

function Bars({ rows, caption }: { rows: BestOfRow[]; caption: string }) {
  const priced = rows.filter((r) => r.barCents !== null);
  const max = Math.max(...priced.map((r) => r.barCents as number));
  return (
    <figure className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8">
      <figcaption className="text-sm font-semibold text-muted">{caption}</figcaption>
      {rows.map((r) => (
        <div key={r.name} className="grid gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[15px] font-semibold text-fg">{r.name}</span>
            <span className="tnum text-right font-display text-xl font-semibold text-fg">
              {r.barCents !== null ? money(r.barCents) : <span className="font-sans text-[13px] font-normal text-muted">no price shown</span>}
              {r.barNote ? <span className="ml-1.5 font-sans text-[13px] font-normal text-muted">{r.barNote}</span> : null}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            {r.barCents !== null ? (
              <div
                className={`h-full rounded-full ${r.ours ? "bg-accent" : "bg-fg/25"}`}
                style={{ width: `${Math.max(6, Math.round((r.barCents / max) * 100))}%` }}
              />
            ) : null}
          </div>
        </div>
      ))}
    </figure>
  );
}

export async function BestOfPage({ kind }: { kind: BestOfKind }) {
  const f = await filewellSide();
  if (!f) notFound();
  const c = COPY[kind];
  const path = BEST_OF_PATHS[kind];
  const rows = kind === "annual-report" ? annualReportRows(f) : registeredAgentRows(f);
  const lede = answer(kind, f, rows);
  const questions = faq(kind, f, rows);
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Compare", path: "/compare" },
    { name: c.crumb, path },
  ];
  const selfRow =
    kind === "annual-report"
      ? ["File it yourself", "$0", "Paid by you", "You fill it in, pay the state and track next year's date"]
      : ["Be your own agent", "$0", "$0", "$0, but your address is public and you must be there in business hours"];
  const other = kind === "annual-report" ? "registered-agent" : "annual-report";

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          articleJsonLd({ headline: `${c.h1} (${BEST_OF_YEAR})`, description: lede[0], path, dateModified: COMPARE_CHECKED }),
          faqJsonLd(questions),
        )}
      />

      <section aria-labelledby="best-title" className="border-b border-border">
        <Container className="grid gap-10 pb-14 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pb-20">
          <div className="grid min-w-0 content-start gap-6">
            <Breadcrumbs items={crumbs} />
            <p className="font-mono text-[12px] uppercase tracking-wider text-subtle">Prices checked on {checkedLabel()}</p>
            <h1 id="best-title" className="text-[34px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[50px]">
              {c.h1} <span className="mark-highlight">({BEST_OF_YEAR})</span>
            </h1>
            <div className="grid max-w-[52ch] gap-3 text-[17px] leading-relaxed text-muted">
              {lede.map((p, i) => (
                <p key={i} className={i === 0 ? "text-fg" : undefined}>
                  {p}
                </p>
              ))}
            </div>
            <p className="flex max-w-[52ch] items-start gap-2 text-[14px] leading-6 text-subtle">
              <Info size={16} weight="fill" aria-hidden className="mt-1 shrink-0" />
              {site.name} is our own service. We&apos;ve listed what each of the others does better, so you can judge for yourself.
            </p>
          </div>
          <Bars rows={rows} caption={c.barCaption} />
        </Container>
      </section>

      <section aria-labelledby="table-title" className="py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="table-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Side by side
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead className="bg-surface-2 text-sm text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                    Service
                  </th>
                  {c.columns.map((col) => (
                    <th key={col} scope="col" className="px-5 py-3 font-semibold sm:px-6">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.name} className={`align-top ${r.ours ? "bg-accent/5" : ""}`}>
                    <th scope="row" className="px-5 py-4 font-semibold text-fg sm:px-6">
                      {r.path ? (
                        <Link href={r.path} className={textLinkClasses}>
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </th>
                    {r.cells.map((cell, i) => (
                      <td key={i} className={`px-5 py-4 sm:px-6 ${r.ours ? "text-fg" : "text-muted"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="align-top">
                  <th scope="row" className="px-5 py-4 font-semibold text-fg sm:px-6">
                    {selfRow[0]}
                  </th>
                  {selfRow.slice(1).map((cell, i) => (
                    <td key={i} className="px-5 py-4 text-muted sm:px-6">
                      {cell}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section aria-labelledby="fit-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="fit-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Which one fits you
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li
                key={r.name}
                className={`grid content-start gap-2 rounded-[var(--radius-surface)] border bg-surface p-5 shadow-card ${r.ours ? "border-accent/50" : "border-border"}`}
              >
                <span className="text-lg font-semibold text-fg">{r.name}</span>
                <span className="flex gap-2 text-[15px] leading-6 text-muted">
                  <Check size={18} weight="bold" aria-hidden className={`mt-0.5 shrink-0 ${r.ours ? "text-accent" : "text-muted"}`} />
                  {r.bestFor}
                </span>
                {r.path ? (
                  <Link href={r.path} className="mt-1 inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-accent">
                    {site.name} vs {r.name}
                    <ArrowRight size={14} weight="bold" aria-hidden />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="method-title" className="py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="grid content-start gap-4">
            <h2 id="method-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              How we compared
            </h2>
            <p className="text-[15px] leading-7 text-muted">
              We read each company&apos;s price on its own website on {checkedLabel()}, not on review sites. Where a company shows no price, we say
              so instead of guessing. Prices can change after that date. State fees are left out because every state sets its own, and every
              service adds them on top.
            </p>
            <p className="text-[13px] leading-6 text-subtle">
              {names(COMPETITORS.map((x) => x.name))} are trademarks of their owners. {site.name} isn&apos;t affiliated with or endorsed by them.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={kind === "annual-report" ? "/find" : "/registered-agent/start"} prefetch={false} className={buttonClasses("primary", "md")}>
                {kind === "annual-report" ? "Check my annual report" : "Get a registered agent"}
              </Link>
              <Link href={BEST_OF_PATHS[other]} className={buttonClasses("secondary", "md")}>
                {COPY[other].crumb}
              </Link>
            </div>
          </div>
          <FaqList items={questions} />
        </Container>
      </section>
    </>
  );
}
