import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Prose, Section } from "@/components/marketing/section";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { formatCents } from "@/lib/domain/money";
import { RA_JURISDICTIONS } from "@/lib/registered-agent/jurisdictions";
import { businessServicesIndexable, businessServicesPagesEnabled, formationSaleCheck } from "@/lib/registered-agent/sales";
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
  const open = RA_JURISDICTIONS.filter((j) => formationSaleCheck(j.code, "llc").ok || formationSaleCheck(j.code, "corporation").ok);
  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro breadcrumbs={<Breadcrumbs items={CRUMBS} />} title="Starting a business" lede={<p>We file your LLC or corporation with the state for one service fee plus the state&apos;s own fee, each on its own line.</p>} />
      <Section>
        <div className="grid gap-8">
          {open.length === 0 ? (
            <Notice tone="info" title="Not open yet">
              <p>
                We only take formation orders in a state once we&apos;ve checked its filing fee on the state&apos;s own site. We haven&apos;t opened any state yet. Nothing on this page is an offer to file today.
              </p>
            </Notice>
          ) : (
            <div className="grid gap-3">
              <p className="text-[15px] text-muted">
                Open in {open.length === 1 ? open[0].name : `${open.length} states`}. Pick yours and see the full price, state fee included, before you pay.
              </p>
              <Link href="/dashboard/services/formation" prefetch={false} className={buttonClasses("primary", "md", "w-fit")}>
                Start your business
              </Link>
            </div>
          )}
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
          </Prose>
        </div>
      </Section>
    </>
  );
}
