import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { AUTHORIZATION_TERMS_VERSION, authorizationText } from "@/lib/filings/customer";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Filing Authorization",
  description: `The authorization you sign before payment so ${site.name} can prepare, sign and submit a specific state filing for your business, and what we record.`,
  path: "/legal/filing-authorization",
});

export default function FilingAuthorizationPage() {
  const template = authorizationText({
    businessName: "[your business]",
    stateName: "[state]",
    filingName: "[filing]",
    brand: site.name,
  });
  const example = authorizationText({
    businessName: "Example Bakery LLC",
    stateName: "Pennsylvania",
    filingName: "Annual Report",
    brand: site.name,
  });

  return (
    <LegalPage
      title="Filing authorization"
      path="/legal/filing-authorization"
      summary={
        <p>
          Before we file anything, you confirm that you can act for the business and authorize us to submit one specific filing.
          This is the exact wording you sign on the Review and sign step, before payment. If your details change after you sign,
          you sign again.
        </p>
      }
    >
      <h2>The authorization text</h2>
      <p>
        Version <strong className="tnum">{AUTHORIZATION_TERMS_VERSION}</strong>. When you sign, the bracketed parts are filled
        in with your business&apos;s legal name, the state and the filing you are ordering.
      </p>
      <blockquote className="mt-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 text-[15px] leading-7 text-fg">
        {template}
      </blockquote>

      <h3>Example</h3>
      <p>For a Pennsylvania annual report for a business named Example Bakery LLC, the text reads:</p>
      <blockquote className="mt-4 rounded-[var(--radius-control)] border border-border bg-surface-2/60 px-4 py-3 text-[15px] leading-7">{example}</blockquote>

      <h2>What it means</h2>
      <ul>
        <li>
          <strong>You can act for the business.</strong> You confirm you are authorized to act on its behalf, for example as an
          owner, officer, member or partner.
        </li>
        <li>
          <strong>Limited scope.</strong> We act as the business&apos;s authorized representative only to prepare, electronically
          sign and submit the one filing described, and to pay its state fee from what you pay for that order. It does not cover
          other filings and does not make us your registered agent.
        </li>
        <li>
          <strong>Your information.</strong> We file the information you provided and reviewed. You confirm it is true, correct
          and complete to the best of your knowledge.
        </li>
        <li>
          <strong>Your alternatives.</strong> You acknowledge that {site.name} is a private filing service, not a government
          agency, does not give legal advice, and that you could file directly with the state instead.
        </li>
        <li>
          <strong>Terms and refunds.</strong> You agree to the <Link href="/legal/terms">terms of service</Link> and{" "}
          <Link href="/legal/refunds">refund policy</Link> in effect when you sign. The text names their last-updated date.
        </li>
      </ul>

      <h2>What we record</h2>
      <p>
        When you authorize a filing, we keep: the name and title you enter as the person authorizing, the version and full text
        of the authorization (including the date of the terms and refund policy you agreed to), a snapshot of the information to
        be filed with a fingerprint of it, the time, a salted hash of your IP address and your browser&apos;s user agent string.
        See the <Link href="/legal/privacy">privacy policy</Link> for how this is stored.
      </p>

      <h2>Cancelling</h2>
      <p>
        You can cancel before we submit the filing and get a full refund. To cancel, send us a message from the filing&apos;s
        page in your dashboard, or email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. See the{" "}
        <Link href="/legal/refunds">refund policy</Link>.
      </p>
    </LegalPage>
  );
}
