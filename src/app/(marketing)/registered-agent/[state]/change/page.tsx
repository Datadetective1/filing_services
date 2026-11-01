import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { RaOtherStates } from "@/components/marketing/ra-state-links";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { getRaJurisdictionBySlug, raJurisdictionsWithPublicFacts } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { changeAgentGuide } from "@/lib/seo/change-agent";
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

/** A step-by-step guide to changing the registered agent, for every state whose change filing we verified. */
export function generateStaticParams() {
  return raJurisdictionsWithPublicFacts().map((j) => ({ state: j.slug }));
}
export const dynamicParams = false;

function load(slug: string) {
  const j = getRaJurisdictionBySlug(slug);
  return j && j.changeOfAgent && raJurisdictionsWithPublicFacts().some((x) => x.code === j.code) ? j : null;
}

export async function generateMetadata(props: PageProps<"/registered-agent/[state]/change">): Promise<Metadata> {
  const { state } = await props.params;
  const j = load(state);
  if (!j?.changeOfAgent) return {};
  const guide = changeAgentGuide(j, null);
  return pageMetadata({
    title: `Change Registered Agent in ${j.name}: Form and Fee`,
    description: `How to change your registered agent in ${j.name}: the ${j.changeOfAgent.formName}${guide?.lowestFeeText ? `, the state fee` : ""} and each step. Or let us file it for you.`,
    path: `/registered-agent/${j.slug}/change`,
    noindex: !businessServicesIndexable(),
  });
}

export default async function ChangeAgentPage(props: PageProps<"/registered-agent/[state]/change">) {
  if (!businessServicesPagesEnabled()) notFound();
  const { state } = await props.params;
  const j = load(state);
  if (!j?.changeOfAgent) notFound();
  const change = j.changeOfAgent;
  const ra = (await publicServicePrices()).registered_agent;
  const priceText = ra !== undefined ? formatCents(ra, { trimZeros: true }) : null;
  const guide = changeAgentGuide(j, priceText);
  if (!guide) notFound();
  const path = `/registered-agent/${j.slug}/change`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Registered agent", path: "/registered-agent" },
    { name: j.name, path: `/registered-agent/${j.slug}` },
    { name: "Change your agent", path },
  ];
  const sources = change.sources.filter((s, k, all) => all.findIndex((x) => x.url === s.url) === k);
  const checked = [...new Set(change.sources.map((s) => s.checkedAt))].sort().pop() ?? "";
  const title = `How to change your registered agent in ${j.name}`;

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(crumbs),
          articleJsonLd({
            headline: title,
            description: `The ${change.formName}, the state fee and each step to change a registered agent in ${j.name}.`,
            path,
            dateModified: checked,
          }),
          faqJsonLd(guide.faq),
        )}
      />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={title}
        lede={
          <p>
            File the {change.formName} with the state{guide.lowestFeeText ? `. The state fee starts at ${guide.lowestFeeText}` : ""}. Or switch to Filewell and we file it
            for you{priceText ? `, included in ${priceText} a year` : ""}.
          </p>
        }
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid content-start gap-8">
            <div className="grid gap-3">
              <SectionHeading title="The state fee" />
              <dl className="grid gap-2 text-[15px]">
                {guide.fees.map((f) => (
                  <div key={f.label} className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted">{f.label}</dt>
                    <dd className="tnum font-semibold text-fg">{f.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="grid gap-4">
              <SectionHeading title="Step by step" />
              <ol className="grid gap-3">
                {guide.steps.map((s, i) => (
                  <li key={s.title} className="flex gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4">
                    <span className="tnum grid size-8 shrink-0 place-items-center rounded-full bg-accent font-display text-sm font-bold text-accent-fg">{i + 1}</span>
                    <span className="grid gap-1">
                      <span className="font-semibold text-fg">{s.title}</span>
                      <span className="text-[15px] leading-6 text-muted">{s.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid gap-2">
              <h2 className="font-semibold text-fg">Official sources{checked ? `, checked ${checked}` : ""}</h2>
              <ul className="grid gap-2 text-sm text-muted">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} className={textLinkClasses} rel="noopener noreferrer" target="_blank">
                      {s.publisher}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <Notice tone="neutral">
              <p>Filewell is a private company, not a government agency. You can also be your own registered agent if you have a street address in {j.name}.</p>
            </Notice>
          </div>
          <Card className="grid content-start gap-3 p-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-fg">Rather we file it?</h2>
            <p className="text-[15px] text-muted">
              {priceText ? `${priceText} a year, the same at renewal. ` : ""}We file the change for you. You pay only the state&apos;s fee.
            </p>
            <Link href={`/registered-agent/start?state=${j.code}`} prefetch={false} className={buttonClasses("primary", "md")}>
              Switch to Filewell
            </Link>
            <Link href={`/registered-agent/${j.slug}`} className={textLinkClasses}>
              {j.name} registered agent service
            </Link>
          </Card>
        </div>
      </Section>
      <Section band>
        <SectionHeading title="Questions" />
        <FaqList items={guide.faq} className="mt-8" />
      </Section>
      <Section>
        <RaOtherStates currentCode={j.code} title="Change your agent in another state" hrefSuffix="/change" />
      </Section>
    </>
  );
}
