import { Buildings, EnvelopeSimple, IdentificationCard, MapPin, ShieldCheck, Star, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { site } from "@/config/site";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { aboutPageJsonLd, breadcrumbJsonLd, graph, organizationJsonLd } from "@/lib/seo/json-ld";
import { assumedNameNoticeText, operatorIntroText, postalAddressText } from "@/lib/seo/legal";
import { pageMetadata } from "@/lib/seo/metadata";

const PATH = "/about";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "About", path: PATH },
];

export const metadata: Metadata = pageMetadata({
  title: `About ${site.name}: Who Runs It and How Filings Are Checked`,
  description: `${site.name} is run by ${site.legalEntityConfigured ? site.legalEntity : "a private company"}${site.postalAddress ? " in Coppell, Texas" : ""}. A person checks every filing before it goes to the state.`,
  path: PATH,
});

function Fact({ icon, term, children }: { icon: ReactNode; term: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-dashed border-border py-4 last:border-b-0">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
        {icon}
      </span>
      <div className="grid min-w-0 gap-0.5">
        <dt className="font-mono text-[11px] uppercase tracking-wider text-subtle">{term}</dt>
        <dd className="text-[16px] leading-6 text-fg">{children}</dd>
      </div>
    </div>
  );
}

export default function AboutPage() {
  const services = businessServicesPagesEnabled();
  const dba = assumedNameNoticeText();
  const steps = [
    { n: "1", title: "You order", body: "Pick your business from the state's register. We fill in what it shows, and you check it." },
    { n: "2", title: "A person checks it", body: "Someone on our team reads every filing against the state's rules before it goes in." },
    { n: "3", title: "We file and follow up", body: "We pay the state's fee at cost, send you the state's confirmation, and help you correct and resubmit it if the state sends it back." },
  ];

  return (
    <>
      <JsonLd data={graph(organizationJsonLd(), aboutPageJsonLd(PATH), breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Who&apos;s behind <span className="mark-highlight">{site.name}</span>
          </>
        }
        lede={
          <p>
            {site.name} is a private filing service run by {operatorIntroText()}. A person checks every filing before it goes to the state, and we
            answer email ourselves.
          </p>
        }
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface px-6 pb-4 pt-6 shadow-lift">
            <span
              aria-hidden
              className="absolute right-0 top-0 size-9 rounded-bl-[8px] bg-[linear-gradient(225deg,var(--bg)_50%,var(--surface-3)_50%)]"
            />
            <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">Company record</p>
            <dl className="mt-2">
              <Fact icon={<Buildings size={20} weight="duotone" />} term="Operating company">
                {site.legalEntityConfigured ? site.legalEntity : site.name}
                {dba ? <span className="block text-[14px] text-muted">{dba}</span> : null}
              </Fact>
              {site.founder ? (
                <Fact icon={<UserCircle size={20} weight="duotone" />} term="Founder">
                  {site.founder}
                </Fact>
              ) : null}
              <Fact icon={<MapPin size={20} weight="duotone" />} term="Mailing address">
                {postalAddressText()}
              </Fact>
              {services ? (
                <Fact icon={<IdentificationCard size={20} weight="duotone" />} term="Registered agent of record">
                  {PROVIDER_LEGAL_NAME}, our provider, is the agent named on the state&apos;s record for our registered agent customers.
                </Fact>
              ) : null}
              <Fact icon={<EnvelopeSimple size={20} weight="duotone" />} term="Contact">
                <a href={`mailto:${site.supportEmail}`} className={textLinkClasses}>
                  {site.supportEmail}
                </a>
              </Fact>
              {site.trustpilotUrl ? (
                <Fact icon={<Star size={20} weight="duotone" />} term="Reviews">
                  <a href={site.trustpilotUrl} className={textLinkClasses} target="_blank" rel="noopener">
                    Read or leave a review on Trustpilot
                  </a>
                </Fact>
              ) : null}
            </dl>
          </div>

          <div className="grid content-start gap-6">
            <SectionHeading title="Why we built it" />
            <div className="grid gap-4 text-[17px] leading-relaxed text-muted">
              <p>
                Small business owners get mail every year that looks official and asks for $100 or more to file a report the state charges a few
                dollars for. We wanted a service that shows the state&apos;s fee and our fee as two separate lines, and charges a fair price for
                the work.
              </p>
              <p>
                So that&apos;s how {site.name} works. The state&apos;s fee is passed through at cost. Our fee is shown before you pay. Registered agent
                service renews at the same price every year.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section band labelledBy="how-title">
        <div className="grid gap-10">
          <SectionHeading id="how-title" title="How every filing is handled" />
          <ol className="grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="grid content-start gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card">
                <span className="tnum font-display text-[40px] font-semibold leading-none text-accent">{s.n}</span>
                <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
                <p className="text-[15px] leading-6 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 text-[15px] text-muted">
            <ShieldCheck size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            {site.disclaimer} We are not a law firm and don&apos;t give legal advice.
          </p>
        </div>
      </Section>

      <Section>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading title="See what your business owes this year" />
          <div className="flex flex-wrap gap-3">
            <Link href="/find" prefetch={false} className={buttonClasses("primary", "md")}>
              Find my business
            </Link>
            <Link href="/pricing" className={buttonClasses("secondary", "md")}>
              See prices
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
