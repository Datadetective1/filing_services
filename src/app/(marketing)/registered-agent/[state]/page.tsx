import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { getRaJurisdictionBySlug, raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled, RA_ENTITY_TYPES } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { publicServicePrices } from "@/lib/services/public-prices";
import { breadcrumbJsonLd, businessServiceJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

/**
 * One page per jurisdiction whose change-of-agent form and fee we verified on the state's own
 * site. Every other jurisdiction has no page (no thin pages): its details appear at checkout
 * once verified.
 */
export function generateStaticParams() {
  return raJurisdictionsWithPublicFacts().map((j) => ({ state: j.slug }));
}
export const dynamicParams = false;

function load(slug: string) {
  const j = getRaJurisdictionBySlug(slug);
  return j && raJurisdictionsWithPublicFacts().some((x) => x.code === j.code) ? j : null;
}

export async function generateMetadata(props: PageProps<"/registered-agent/[state]">): Promise<Metadata> {
  const { state } = await props.params;
  const j = load(state);
  if (!j) return {};
  return pageMetadata({
    title: `${j.name} Registered Agent Service`,
    description: `Registered agent service in ${j.name}, and how changing your registered agent works there: the state's form, its fee and what we file for you.`,
    path: `/registered-agent/${j.slug}`,
    noindex: !businessServicesIndexable(),
  });
}

export default async function RegisteredAgentStatePage(props: PageProps<"/registered-agent/[state]">) {
  if (!businessServicesPagesEnabled()) notFound();
  const { state } = await props.params;
  const j = load(state);
  if (!j || !j.changeOfAgent) notFound();
  const prices = await publicServicePrices();
  const change = j.changeOfAgent;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Registered agent", path: "/registered-agent" },
    { name: j.name, path: `/registered-agent/${j.slug}` },
  ];
  const checked = [...new Set(change.sources.map((s) => s.checkedAt))].sort().pop();

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          businessServiceJsonLd({
            name: `${j.name} registered agent service`,
            serviceType: "Registered agent service",
            description: `Registered agent service in ${j.name}, including filing the change of registered agent with the state when you switch.`,
            path: `/registered-agent/${j.slug}`,
            stateName: j.name,
            offer:
              prices.registered_agent !== undefined
                ? { name: `${j.name} registered agent service, one year`, priceCents: prices.registered_agent, description: "Yearly price, the same at renewal. The state's fee for the change of agent is shown separately before you pay." }
                : undefined,
          }),
        )}
      />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={`Registered agent service in ${j.name}`}
        lede={
          <p>
            {prices.registered_agent !== undefined ? `${formatCents(prices.registered_agent, { trimZeros: true })} a year, the same at renewal. ` : ""}
            Switching from your current agent? We file the {j.name} change for you; you pay the state&apos;s fee.
          </p>
        }
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-6">
            <SectionHeading title={`Changing your registered agent in ${j.name}`} />
            <Card className="grid gap-3 p-5 text-[15px]">
              <p>
                <span className="font-semibold text-fg">The filing:</span> <span className="text-muted">{change.formName}</span>
              </p>
              <div>
                <p className="font-semibold text-fg">The state&apos;s fee</p>
                <ul className="mt-1 grid gap-1 text-muted">
                  {RA_ENTITY_TYPES.map((t) => {
                    const fee = change.governmentFeeCents[t];
                    return (
                      <li key={t}>
                        {ENTITY_TYPE_LABELS[t]}: {typeof fee === "number" ? (fee === 0 ? "no state fee" : formatCents(fee)) : "not verified yet, so we can't take this order online"}
                      </li>
                    );
                  })}
                </ul>
              </div>
              {change.newAgentConsentRequired ? (
                <p className="text-muted">The state requires the new agent&apos;s consent. We arrange it with our provider before the change is filed.</p>
              ) : null}
              <p className="text-muted">
                Our filing service for the change is included. Your registered agent service starts once the state&apos;s record shows {PROVIDER_LEGAL_NAME} as your agent.
              </p>
            </Card>
            <div className="grid gap-2">
              <h3 className="font-semibold text-fg">Sources{checked ? `, checked ${checked}` : ""}</h3>
              <ul className="grid gap-2 text-sm text-muted">
                {change.sources.filter((s, k, all) => all.findIndex((x) => x.url === s.url) === k).map((s) => (
                  <li key={s.url}>
                    <a href={s.url} className={textLinkClasses} rel="noopener noreferrer" target="_blank">
                      {s.publisher}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <Notice tone="neutral">
              <p>
                You can also change your agent yourself on the {j.name} filing site for the state fee alone. Filewell is not affiliated with the state.
              </p>
            </Notice>
          </div>
          <Card className="grid content-start gap-3 p-5">
            <h2 className="text-lg font-semibold text-fg">Ready to switch?</h2>
            <p className="text-[15px] text-muted">Look up your business and we fill in the order for you.</p>
            <Link href={`/registered-agent/start?state=${j.code}`} prefetch={false} className={buttonClasses("primary", "md")}>
              Get started
            </Link>
            <Link href="/registered-agent" className={textLinkClasses}>
              How registered agent service works
            </Link>
          </Card>
        </div>
      </Section>
    </>
  );
}
