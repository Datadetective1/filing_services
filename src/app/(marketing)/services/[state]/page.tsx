import {
  ArrowRight,
  ArrowsClockwise,
  Buildings,
  CalendarCheck,
  ChatCircleText,
  Receipt,
  RocketLaunch,
  Stack,
  UserCheck,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TrackView } from "@/components/analytics/track-view";
import { StatePicker } from "@/components/funnel/state-picker";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { StateTileMap } from "@/components/visual/state-tile-map";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable } from "@/lib/registered-agent/sales";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import {
  pickableStateBySlug,
  pickableStates,
  stateServices,
  type StateServiceKey,
  type StateServiceOffer,
} from "@/lib/services/state-services";

// Prices and switches can change: rebuild at most hourly, like the pricing page.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return pickableStates().map((s) => ({ state: s.slug }));
}

export async function generateMetadata(props: PageProps<"/services/[state]">): Promise<Metadata> {
  const { state } = await props.params;
  const s = pickableStateBySlug(state);
  if (!s) return {};
  return pageMetadata({
    title: `Business Filings in ${s.name}: What Filewell Can Do`,
    description: `Everything Filewell can do for your ${s.name} business, with the full price up front: forming a business, registered agent service and annual reports where they're open.`,
    path: `/services/${s.slug}`,
    noindex: !businessServicesIndexable(),
  });
}

const money = (c: number) => formatCents(c, { trimZeros: true });

const ICONS: Record<StateServiceKey, ReactNode> = {
  formation: <RocketLaunch size={22} weight="fill" aria-hidden />,
  registered_agent: <Buildings size={22} weight="fill" aria-hidden />,
  bundle: <Stack size={22} weight="fill" aria-hidden />,
  annual_report: <CalendarCheck size={22} weight="fill" aria-hidden />,
};

const PROMISES = [
  { icon: Receipt, title: "State fee at cost" },
  { icon: ArrowsClockwise, title: "Same price at renewal" },
  { icon: UserCheck, title: "A person checks every filing" },
];

/** How many options a card shows before the rest fold away (Pennsylvania has eight report types). */
const VISIBLE_OPTIONS = 3;

export default async function StateServicesPage(props: PageProps<"/services/[state]">) {
  const { state } = await props.params;
  const picked = pickableStateBySlug(state);
  if (!picked) notFound();
  const view = await stateServices(picked.code);
  if (!view) notFound();
  const states = pickableStates();
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Your state", path: "/services" },
    { name: view.name, path: `/services/${view.slug}` },
  ];
  const count = view.offered.length;

  return (
    <>
      <TrackView event="state_page_viewed" stateCode={view.code} />
      <JsonLd data={graph(breadcrumbJsonLd(crumbs))} />

      {/* Hero: the state, how many services, and a way to switch states */}
      <section aria-labelledby="state-services-title" className="relative overflow-hidden bg-ink text-ink-fg">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_10%,rgb(242_178_58/0.16),transparent_60%),radial-gradient(50rem_30rem_at_0%_100%,rgb(31_90_67/0.55),transparent_60%)]"
        />
        <Container className="relative grid items-center gap-10 pb-10 pt-6 sm:pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-14 lg:pb-20">
          <div className="grid content-start gap-6">
            <Link href="/services" className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-medium text-ink-muted hover:text-ink-fg">
              <ArrowRight size={14} weight="bold" aria-hidden className="rotate-180" />
              Change state
            </Link>
            <p className="inline-flex items-center gap-2 justify-self-start rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-sm font-medium">
              <span aria-hidden className="size-2 rounded-full bg-highlight shadow-[0_0_12px_rgb(242_178_58/0.9)]" />
              {count === 0 ? "Not open yet" : count === 1 ? "1 service available" : `${count} services available`}
            </p>
            <h1
              id="state-services-title"
              className="text-[48px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[68px] lg:text-[80px]"
            >
              {view.name}
            </h1>
            <p className="max-w-[38ch] text-lg leading-relaxed text-ink-muted sm:text-xl">
              {count > 0
                ? `Everything we can do for your business in ${view.name}, with the full price up front.`
                : `We can't take orders in ${view.name} yet.`}
            </p>
            {/* On a phone the services come first; "All states" above does the switching there. */}
            <div className="hidden max-w-xl rounded-[var(--radius-surface)] border border-white/12 bg-white/[0.05] p-5 backdrop-blur-sm sm:block">
              <StatePicker states={states} initialSlug={view.slug} label="Another state?" cta="Switch" tone="glass" />
            </div>
          </div>
          <StateTileMap states={states} active={view.code} tilt className="mx-auto hidden w-full max-w-[34rem] py-4 sm:block lg:py-10" />
        </Container>
      </section>

      {/* The services, as cards with real totals */}
      <section aria-labelledby="offered-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <h2 id="offered-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            {count > 0 ? `What you can do in ${view.name}` : `Nothing to order in ${view.name} yet`}
          </h2>
          {count > 0 ? (
            <ul className={`grid gap-4 md:grid-cols-2 ${count >= 3 ? "xl:grid-cols-3" : ""}`} aria-label={`Services in ${view.name}`}>
              {view.offered.map((o) => (
                <ServiceCard key={o.key} offer={o} />
              ))}
            </ul>
          ) : (
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-muted">
              We open a state only once we&apos;ve checked its fees on the state&apos;s own site. Write to us and we&apos;ll tell you when{" "}
              {view.name} is ready.
            </p>
          )}

          {view.notOffered.length > 0 && count > 0 ? (
            <div className="grid gap-2 rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 px-5 py-4">
              <p className="text-sm font-semibold text-fg">Not in {view.name} yet</p>
              <ul className="grid gap-1 text-sm leading-6 text-muted">
                {view.notOffered.map((g) => (
                  <li key={g.key}>{g.note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Our promises">
            {PROMISES.map(({ icon: Icon, title }) => (
              <li key={title} className="inline-flex items-center gap-2 text-[15px] font-medium text-fg">
                <Icon size={18} weight="fill" aria-hidden className="text-accent" />
                {title}
              </li>
            ))}
          </ul>

          <p className="flex items-center gap-2 text-[15px] text-muted">
            <ChatCircleText size={18} weight="bold" aria-hidden className="text-accent" />
            Not sure what you need?{" "}
            <Link href="/help" className={textLinkClasses}>
              Ask a person
            </Link>
          </p>
          <DisclaimerNote />
        </Container>
      </section>
    </>
  );
}

function ServiceCard({ offer }: { offer: StateServiceOffer }) {
  const from = Math.min(...offer.options.map((o) => o.totalCents));
  // A yearly plan has one price for everyone: no "From", no per-type rows.
  const plan = offer.key === "registered_agent" || offer.key === "bundle";
  const one = offer.options.length === 1;
  const shown = offer.options.slice(0, VISIBLE_OPTIONS);
  const rest = offer.options.slice(VISIBLE_OPTIONS);
  const featured = offer.key === "bundle";
  return (
    <li className="grid">
      <div
        className={`relative flex flex-col gap-5 overflow-hidden rounded-[var(--radius-surface)] border p-6 ${
          featured ? "border-ink bg-ink text-ink-fg shadow-lift" : "border-border bg-surface text-fg shadow-card"
        }`}
      >
        {featured ? (
          <span className="absolute right-5 top-5 rounded-full bg-highlight px-3 py-1 text-xs font-bold uppercase tracking-wider text-highlight-fg">
            Best value
          </span>
        ) : null}
        <div className="flex items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${featured ? "bg-highlight text-highlight-fg" : "bg-highlight-soft text-highlight-fg"}`}>
            {ICONS[offer.key]}
          </span>
          <h3 className="text-[19px] font-semibold">{offer.title}</h3>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          {one ? null : <span className={`text-sm ${featured ? "text-ink-muted" : "text-muted"}`}>From</span>}
          <span className="tnum font-display text-[44px] font-semibold leading-none tracking-tight">{money(from)}</span>
          <span className={`text-sm ${featured ? "text-ink-muted" : "text-muted"}`}>{offer.cadence}</span>
        </p>
        <p className={`text-[15px] leading-6 ${featured ? "text-ink-muted" : "text-muted"}`}>{offer.blurb}</p>
        <ul className={`grid flex-1 content-end divide-y overflow-hidden rounded-[var(--radius-control)] border ${featured ? "divide-white/10 border-white/15" : "divide-border border-border"}`}>
          {shown.map((o) => (
            <OptionRow key={o.label} option={o} featured={featured} plan={plan} />
          ))}
          {rest.length > 0 ? (
            <li>
              <details className="group">
                <summary
                  className={`flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold ${featured ? "text-ink-fg" : "text-accent"}`}
                >
                  {rest.length} more business {rest.length === 1 ? "type" : "types"}
                  <ArrowRight size={15} weight="bold" aria-hidden className="rotate-90 transition-transform group-open:-rotate-90" />
                </summary>
                <ul className={`divide-y border-t ${featured ? "divide-white/10 border-white/15" : "divide-border border-border"}`}>
                  {rest.map((o) => (
                    <OptionRow key={o.label} option={o} featured={featured} plan={false} />
                  ))}
                </ul>
              </details>
            </li>
          ) : null}
        </ul>
        {offer.note ? <p className={`text-sm leading-6 ${featured ? "text-ink-muted" : "text-muted"}`}>{offer.note}</p> : null}
      </div>
    </li>
  );
}

function OptionRow({
  option,
  featured,
  plan,
}: {
  option: StateServiceOffer["options"][number];
  featured: boolean;
  plan: boolean;
}) {
  const split =
    plan || option.stateCents === null
      ? null
      : option.stateCents === 0
        ? "No state fee"
        : `${money(option.serviceCents)} ours + ${money(option.stateCents)} state`;
  const label = plan ? "Get started" : option.label;
  return (
    <li>
      <Link
        href={option.href}
        prefetch={false}
        className={`group grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors ${
          featured ? "bg-white/[0.04] hover:bg-white/[0.1]" : "hover:bg-accent-soft/60"
        }`}
      >
        <span className="grid min-w-0">
          <span className={`font-semibold ${featured ? "text-ink-fg" : "text-fg group-hover:text-accent"}`}>{label}</span>
          {split ? <span className={`tnum text-[13px] ${featured ? "text-ink-muted" : "text-muted"}`}>{split}</span> : null}
        </span>
        <span className="inline-flex items-center gap-2">
          {plan ? null : <span className="tnum font-display text-lg font-semibold">{money(option.totalCents)}</span>}
          <span
            className={`grid size-8 place-items-center rounded-full transition-transform group-hover:translate-x-0.5 ${
              featured ? "bg-highlight text-highlight-fg" : "bg-accent text-accent-fg"
            }`}
          >
            <ArrowRight size={15} weight="bold" aria-hidden />
          </span>
        </span>
      </Link>
    </li>
  );
}
