import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Disclaimer",
  description: `${site.name} is a private filing service, not a government agency. How we source compliance information, and why it is not legal advice.`,
  path: "/legal/disclaimer",
});

export default function DisclaimerPage() {
  const brand = site.name;
  return (
    <LegalPage
      title="Disclaimer"
      path="/legal/disclaimer"
      summary={
        <p>
          <strong className="font-semibold">{site.disclaimer}</strong> You can always file directly with your state.
        </p>
      }
    >
      <h2>Not a government agency</h2>
      <p>
        {brand} is a private company. We are not a government agency, and we are not affiliated with, endorsed by or acting for
        any state, federal or local government office. State names and agency names appear on our site only to describe the
        filings they administer.
      </p>

      <h2>You can file directly</h2>
      <p>
        A business can file directly with its state and pay only the state fee. Using {brand} is optional. For the states we
        support, our pages link to the state&apos;s own filing system. We charge a service fee, shown separately from the state fee, for preparing and submitting a filing for you.
      </p>

      <h2>Where our information comes from</h2>
      <p>
        We present due dates, fees and filing requirements as facts only for states we have verified. For those states, each fact
        comes from an official government publication, such as the state agency&apos;s website, its forms and instructions, or
        the state&apos;s statutes. Each page lists its sources, a short excerpt from each one, and the date we last reviewed it.
      </p>
      <p>
        For states we have not verified, we do not state due dates or fees. Those pages show only the official agency&apos;s
        website and business search, as a directory listing.
      </p>
      <p>
        Laws and state procedures change. We review our sources, but a summary can fall behind a change. If our summary differs
        from the official source, the official source controls.
      </p>

      <h2>Not legal advice</h2>
      <p>
        We are not a law firm, and nothing on this site is legal, tax or accounting advice. Our pages summarize published
        requirements in general terms. They do not consider your business&apos;s particular situation. For advice about your
        obligations, talk to a licensed attorney or accountant.
      </p>

      <h2>No guarantee of state action</h2>
      <p>
        When we file for you, the state decides whether to accept the filing and how quickly to process it. See the{" "}
        <Link href="/legal/terms">terms of service</Link> for details.
      </p>

      <h2>External links</h2>
      <p>
        We link to official government websites for your convenience and so you can check our sources. We do not control those
        sites.
      </p>
    </LegalPage>
  );
}
