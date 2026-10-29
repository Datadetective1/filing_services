import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Prose, Section } from "@/components/marketing/section";
import { textLinkClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { businessServicesIndexable, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Business Formation",
    description: "Form an LLC or corporation with Filewell: one service fee plus the state's filing fee, with registered agent service only if you choose it.",
    path: "/business-formation",
    noindex: !businessServicesIndexable(),
  });
}

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Business formation", path: "/business-formation" },
];

export default async function BusinessFormationPage() {
  if (!businessServicesPagesEnabled()) notFound();
  const prices = await publicServicePrices();
  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro breadcrumbs={<Breadcrumbs items={CRUMBS} />} title="Starting a business" lede={<p>Formation with Filewell isn&apos;t open yet. Here is how it will work and what it will cost.</p>} />
      <Section>
        <div className="grid gap-8">
          <Notice tone="info" title="Not open yet">
            <p>
              We only take formation orders in a state once we&apos;ve checked its filing fee on the state&apos;s own site. We haven&apos;t opened any state yet. Nothing on this page is an offer to file today.
            </p>
          </Notice>
          <Prose>
            <h2>What it will cost</h2>
            <ul>
              <li>
                Our formation service{prices.formation !== undefined ? `: ${formatCents(prices.formation, { trimZeros: true })}` : ""}, plus the state&apos;s filing fee, passed through at cost on its own line.
              </li>
              <li>
                Registered agent service is optional{prices.registered_agent !== undefined ? ` (${formatCents(prices.registered_agent, { trimZeros: true })} a year)` : ""}. We never add it unless you tick it, and you can name any agent you like.
              </li>
            </ul>
            <h2>Already have a business?</h2>
            <p>
              <Link href="/registered-agent" className={textLinkClasses}>
                Registered agent service
              </Link>{" "}
              and{" "}
              <Link href="/annual-report" className={textLinkClasses}>
                annual report filing
              </Link>{" "}
              are for businesses that already exist.
            </p>
            <p>Filewell is not a law firm and doesn&apos;t give legal or tax advice.</p>
          </Prose>
        </div>
      </Section>
    </>
  );
}
