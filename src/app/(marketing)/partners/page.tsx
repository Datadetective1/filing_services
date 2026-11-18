import { ArrowRight, BellRinging, Handshake, LinkSimple, Stack, UserCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/config/site";
import { formatCents } from "@/lib/domain/money";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { publicServicePrices } from "@/lib/services/public-prices";
import { annualReportPlaces } from "@/lib/services/state-services";
import type { FaqItem } from "@/lib/compliance/types";
import { FaqList } from "@/components/marketing/faq";

export const revalidate = 3600;

const PATH = "/partners";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "For accountants", path: PATH },
];

export const metadata: Metadata = pageMetadata({
  title: "For Accountants and Bookkeepers: Send Clients' Annual Reports to Filewell",
  description: `Accountants, bookkeepers and tax preparers: send clients to ${site.name} for annual reports and registered agent service at flat prices, with the state fee shown separately. Free partner link.`,
  path: PATH,
  absoluteTitle: true,
});

function mailto(): string {
  const subject = "Partner link request";
  const body = "Firm name:\nWebsite:\nStates where most of your clients are:\n";
  return `mailto:${site.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="grid content-start gap-1 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card">
      <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">{label}</span>
      <span className="tnum font-display text-[34px] font-semibold leading-none text-fg">{value}</span>
      <span className="text-[14px] leading-5 text-muted">{note}</span>
    </div>
  );
}

function Perk({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-accent/10 text-accent">
        {icon}
      </span>
      <span className="grid gap-1">
        <span className="font-semibold text-fg">{title}</span>
        <span className="text-[15px] leading-6 text-muted">{children}</span>
      </span>
    </li>
  );
}

export default async function PartnersPage() {
  const services = businessServicesPagesEnabled();
  const [prices, places] = await Promise.all([
    services ? publicServicePrices().catch(() => ({}) as Awaited<ReturnType<typeof publicServicePrices>>) : Promise.resolve({} as Awaited<ReturnType<typeof publicServicePrices>>),
    annualReportPlaces().catch(() => []),
  ]);
  const money = (c: number) => formatCents(c, { trimZeros: true });
  const reportFrom = places.length ? Math.min(...places.map((p) => p.serviceCents)) : null;
  const ra = prices.registered_agent;
  const bundle = prices.ra_annual_report_bundle;
  const reward = site.referralReward;

  const faq: FaqItem[] = [
    {
      q: "Do my clients pay you or me?",
      a: `They order and pay ${site.name} directly. The state's fee is passed through at cost and shown as its own line before they pay.`,
    },
    {
      q: "Do I need an account?",
      a: "No. Email us your firm name and we send back your own link. Anyone who orders after using it is credited to you.",
    },
    ...(reward ? [{ q: "What do I earn?", a: `${reward}. We confirm the details when we send your link.` }] : []),
    {
      q: "Who checks the filings?",
      a: "A person on our team checks every filing against the state's rules before it goes in, and the client gets the state's confirmation.",
    },
  ];

  return (
    <>
      <JsonLd data={graph(faqJsonLd(faq), breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Your clients&apos; state filings, <span className="mark-highlight">off your plate</span>
          </>
        }
        lede={
          <p>
            For accountants, bookkeepers and tax preparers. Send clients to {site.name} for annual reports and registered agent service at flat prices,
            with the state&apos;s fee shown on its own line.
          </p>
        }
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <a href={mailto()} className={buttonClasses("primary", "md")}>
            Get my partner link
            <ArrowRight size={18} aria-hidden />
          </a>
          <Link href="/tools/deadline-badge" className={buttonClasses("secondary", "md")}>
            Get the free badge
          </Link>
        </div>
      </PageIntro>

      <Section>
        <div className="grid gap-10">
          <SectionHeading title="What your clients pay" lede="The same prices every client sees on our site. The state's fee is extra and passed through at cost." />
          <div className="grid gap-4 sm:grid-cols-3 [perspective:1200px]">
            {reportFrom !== null ? <Tile label="Annual report" value={`${money(reportFrom)}+`} note={`plus the state fee, in ${places.length} states`} /> : null}
            {ra !== undefined ? <Tile label="Registered agent" value={money(ra)} note="a year, the same at renewal" /> : null}
            {bundle !== undefined ? <Tile label="Agent + annual report" value={money(bundle)} note="a year, plus the state's report fee" /> : null}
          </div>
        </div>
      </Section>

      <Section band>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionHeading title="What you get" lede="No contract and nothing to install." />
          <ul className="grid gap-4">
            <Perk icon={<LinkSimple size={22} weight="duotone" />} title="Your own link">
              Clients who order through it are credited to your firm.{reward ? ` ${reward}.` : ""}
            </Perk>
            <Perk icon={<BellRinging size={22} weight="duotone" />} title="Free reminders for every client">
              Clients can sign up for an email before each report is due, even if they never order.
            </Perk>
            <Perk icon={<Stack size={22} weight="duotone" />} title="A deadline badge for your site">
              Show your state&apos;s due date and fee on your website with one line of code.
            </Perk>
            <Perk icon={<UserCheck size={22} weight="duotone" />} title="A person checks every filing">
              Before it goes to the state. We answer client questions by email, so they don&apos;t land on your desk.
            </Perk>
          </ul>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <SectionHeading title="Questions" />
          <FaqList items={faq} />
        </div>
      </Section>

      <Section band>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-3 text-[30px] font-semibold leading-[1.08] text-fg sm:text-[42px]">
            <Handshake size={36} weight="duotone" aria-hidden className="text-accent" />
            Get your partner link
          </h2>
          <a href={mailto()} className={buttonClasses("primary", "md")}>
            Email us
          </a>
        </div>
      </Section>
    </>
  );
}
