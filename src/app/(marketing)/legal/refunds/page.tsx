import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Refund Policy",
  description: `When ${site.name} refunds filing orders: a full refund before we submit to the state, and our service fee back if we made an error or cannot complete the filing.`,
  path: "/legal/refunds",
});

export default function RefundsPage() {
  const brand = site.name;
  return (
    <LegalPage
      title="Refund policy"
      path="/legal/refunds"
      summary={
        <p>
          Full refund before we submit your filing to the state. After we submit, the state keeps its fee. We refund our service
          fee if we made an error or cannot complete the filing.
        </p>
      }
    >
      <h2>Before we submit to the state</h2>
      <p>
        You can cancel an order at any time before we submit the filing to the state, and we will refund the full amount: the
        state fee and our service fee. At that point we have not paid anything to the state.
      </p>
      <p>
        To cancel, send us a message from the filing&apos;s page in your dashboard, or email{" "}
        <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. If we have already submitted the filing when we receive
        your request, the rules below for submitted filings apply.
      </p>

      <h2>After we submit to the state</h2>
      <p>
        When we submit a filing, we pay the state fee to the state on your business&apos;s behalf. Because that money has
        already been paid to the state, the state fee is not refundable once the filing has been submitted.
      </p>
      <p>
        Some states process online filings very quickly. In Pennsylvania, for example, online annual reports are approved
        automatically, usually within minutes, so there may be little time between submission and acceptance.
      </p>

      <h2>When we refund our service fee</h2>
      <ul>
        <li>
          <strong>We made an error</strong> in preparing or submitting the filing. We will first offer to correct and resubmit it
          at no additional service fee. If you would rather have a refund, we will refund our service fee.
        </li>
        <li>
          <strong>We cannot complete the filing</strong>, for example because the state&apos;s system will not accept it for a
          reason we cannot resolve, or because we determine that we should not file it. If we have not submitted anything, you get
          a full refund.
        </li>
        <li>
          <strong>You were charged twice</strong> for the same filing. We refund the duplicate in full.
        </li>
      </ul>

      <h2>When we do not refund the service fee</h2>
      <ul>
        <li>The filing was submitted as you authorized it, using the information you provided and confirmed.</li>
        <li>
          The state rejected the filing because of information you provided. We will help you correct it and resubmit. [Whether an
          additional state fee applies depends on the state.]
        </li>
        <li>You no longer need the filing after it has been submitted.</li>
      </ul>

      <h2>How to request a refund</h2>
      <p>
        Send us a message from the filing&apos;s page in your dashboard, or email{" "}
        <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> from the address on your account, with the business name
        and the filing you are asking about. We will reply as soon as we can, normally within a few business days.
      </p>
      <p>
        Refunds go back to the original payment method. We record the state fee and service fee parts of a refund separately and
        tell you how much of each was refunded. How long the refund takes to appear depends on your bank or card issuer.
      </p>

      <h2>Related</h2>
      <p>
        See the <Link href="/legal/terms">terms of service</Link> for how fees work, and{" "}
        <Link href="/pricing">pricing</Link> for current fees. {brand} is a private filing service. You can always file directly
        with your state for the state fee alone.
      </p>
    </LegalPage>
  );
}
