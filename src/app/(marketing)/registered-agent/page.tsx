import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { REGISTERED_AGENT_FAQ } from "@/lib/services/public-faq";
import { publicServicePrices } from "@/lib/services/public-prices";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Registered Agent Service",
    description:
      "Registered agent service for LLCs and corporations: one yearly price, the same at renewal. Legal documents and notices go to your dashboard and your inbox.",
    path: "/registered-agent",
    noindex: !businessServicesIndexable(),
  });
}

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Registered agent", path: "/registered-agent" },
];

const STEPS = [
  { title: "Order", body: "Tell us about your business and who we should contact. You see every charge, including any state fee, before you pay." },
  { title: "We set it up", body: `We place your order with ${PROVIDER_LEGAL_NAME} and, if you're switching, file the change with your state.` },
  { title: "We confirm it", body: "Your service becomes active once the appointment is confirmed (and the state's record shows the change). We email you when it does." },
  { title: "We forward what arrives", body: "Legal documents and government notices go to your dashboard, and we email you. For legal documents we also try to call." },
];

export default async function RegisteredAgentPage() {
  if (!businessServicesPagesEnabled()) notFound();
  const prices = await publicServicePrices();
  const states = raJurisdictionsWithPublicFacts();
  const ra = prices.registered_agent;
  const bundle = prices.ra_annual_report_bundle;

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title="Registered agent service, one clear yearly price"
        lede={
          <p>
            {ra !== undefined ? `${formatCents(ra, { trimZeros: true })} a year, and the same price when it renews. ` : ""}
            We receive lawsuits and official notices for your business and put them in front of you. The registered agent on the state&apos;s record is our provider, {PROVIDER_LEGAL_NAME}.
          </p>
        }
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="grid content-start gap-6">
            <SectionHeading title="Which describes you?" />
            <div className="grid gap-4">
              <Card className="grid gap-2 p-5">
                <h3 className="text-lg font-semibold text-fg">I already have a business</h3>
                <p className="text-[15px] text-muted">
                  Add your business, then choose registered agent service from its page. If another agent is listed today, we file the change with the state: you pay the state&apos;s fee and our filing is included.
                </p>
                <Link href="/find" className={buttonClasses("primary", "md", "mt-2 w-fit")}>
                  Find your business
                </Link>
              </Card>
              <Card className="grid gap-2 p-5">
                <h3 className="text-lg font-semibold text-fg">I&apos;m starting a business</h3>
                <p className="text-[15px] text-muted">
                  You name your registered agent when you form the business. Business formation with Filewell isn&apos;t open yet.{" "}
                  <Link href="/business-formation" className={textLinkClasses}>
                    Read how it will work
                  </Link>
                  .
                </p>
              </Card>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <SectionHeading title="What it costs" />
            <dl className="grid gap-3 text-[15px]">
              {ra !== undefined ? (
                <div className="flex justify-between gap-4 border-b border-border pb-3">
                  <dt className="text-muted">Registered agent, per business, per state</dt>
                  <dd className="tnum font-semibold text-fg">{formatCents(ra, { trimZeros: true })} / year</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted">Switching from another agent</dt>
                <dd className="text-right font-semibold text-fg">State fee only; our filing is included</dd>
              </div>
              {bundle !== undefined ? (
                <div className="flex justify-between gap-4 border-b border-border pb-3">
                  <dt className="text-muted">Registered agent + annual report filing, where we file annual reports</dt>
                  <dd className="tnum font-semibold text-fg">{formatCents(bundle, { trimZeros: true })} / year + state report fee</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-sm text-muted">
              Renews every year at the same price unless you turn off renewal before the renewal date. Government fees are passed through at cost and shown on their own line.
            </p>
          </div>
        </div>
      </Section>

      <Section band>
        <SectionHeading title="How it works" />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="grid h-full content-start gap-2 p-5">
                <span className="text-sm font-semibold text-subtle">Step {i + 1}</span>
                <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
                <p className="text-[15px] text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {states.length > 0 ? (
        <Section>
          <SectionHeading
            title="Changing your agent, state by state"
            lede="Where we've checked the state's own form and fee, the details are here. Other states: we'll show the fee at checkout once we've verified it."
          />
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {states.map((j) => (
              <li key={j.code}>
                <Link href={`/registered-agent/${j.slug}`} className={textLinkClasses}>
                  {j.name}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section band>
        <SectionHeading title="Questions" />
        <FaqList items={REGISTERED_AGENT_FAQ} className="mt-8" />
        <Notice className="mt-8" tone="neutral">
          <p>Filewell is not a law firm and is not affiliated with any government agency. Nothing here is legal advice.</p>
        </Notice>
      </Section>
    </>
  );
}
