import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section } from "@/components/marketing/section";
import { StateGrid } from "@/components/marketing/state-grid";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Business Filings by State",
  description:
    "All 50 states and DC, with an honest status for each. Pennsylvania is supported. Other states are listed as not yet verified, with a link to the official agency.",
  path: "/states",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "States", path: "/states" },
];

export default function StatesPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title="Browse by state"
        lede={
          <p>
            We support a state once we have checked its filing requirements against official government sources. Until then,
            its page shows only the official agency, with no due dates or fees.
          </p>
        }
      />
      <Section>
        <StateGrid basePath="/states" />
        <DisclaimerNote className="mt-10" />
      </Section>
    </>
  );
}
