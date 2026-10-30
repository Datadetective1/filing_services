import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { REGISTERED_AGENT_FAQ } from "@/lib/services/public-faq";
import { publicServicePrices } from "@/lib/services/public-prices";
import { breadcrumbJsonLd, businessServiceJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
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
  { title: "We forward what arrives", body: "We scan legal documents and government notices to your secure dashboard and email you, so you can read them from anywhere." },
];

export default async function RegisteredAgentPage() {
  if (!businessServicesPagesEnabled()) notFound();
  const prices = await publicServicePrices();
  const states = raJurisdictionsWithPublicFacts();
  const ra = prices.registered_agent;
  const bundle = prices.ra_annual_report_bundle;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(CRUMBS),
          businessServiceJsonLd({
            name: "Registered agent service",
            serviceType: "Registered agent service",
            description: "Registered agent service for LLCs and corporations. Legal documents and government notices are scanned to your dashboard and emailed to you.",
            path: "/registered-agent",
            offer:
              ra !== undefined
                ? { name: "Registered agent service, one year", priceCents: ra, description: "Yearly price, the same at renewal. Any state fee for changing your agent is shown separately before you pay." }
                : undefined,
          }),
          faqJsonLd(REGISTERED_AGENT_FAQ),
        )}
      />
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
                  Look up your business and we fill in the order for you. We file the change of agent with the state: you pay only the state&apos;s fee.
                </p>
                <Link href="/registered-agent/start" prefetch={false} className={buttonClasses("primary", "md", "mt-2 w-fit")}>
                  Get started
                </Link>
              </Card>
              <Card className="grid gap-2 p-5">
                <h3 className="text-lg font-semibold text-fg">I&apos;m starting a business</h3>
                <p className="text-[15px] text-muted">
                  You name your registered agent when you form the business, so there&apos;s nothing to switch. Forming it yourself? We give you our agent&apos;s
                  details for your filing. Or{" "}
                  <Link href="/business-formation" className={textLinkClasses}>
                    let us form it
                  </Link>
                  .
                </p>
                <Link href="/dashboard/services/new-business" prefetch={false} className={buttonClasses("secondary", "md", "mt-2 w-fit")}>
                  Get an agent for a new business
                </Link>
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
              Renews yearly at the same price. Turn off renewal any time. State fees are passed through at cost.
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
      </Section>
    </>
  );
}
