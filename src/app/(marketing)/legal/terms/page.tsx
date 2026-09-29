import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: `The terms for using ${site.name}, a private filing service that prepares and submits business filings. Not a government agency and not a law firm.`,
  path: "/legal/terms",
});

export default function TermsPage() {
  const brand = site.name;
  return (
    <LegalPage
      title="Terms of service"
      path="/legal/terms"
      summary={
        <p>
          In short: {brand} is a private filing service, not a government agency and not a law firm. We prepare and submit
          filings using the information you give us, and you are responsible for that information being accurate. You can always
          file directly with your state instead.
        </p>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        These terms are an agreement between you and {site.legalEntity} (&ldquo;{brand}&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;), which operates this website and the filing service described here. By creating an account or ordering
        a filing, you agree to these terms.
      </p>
      <ul>
        <li>
          <strong>We are a private company.</strong> We are not a government agency and are not affiliated with or endorsed by any
          government agency.
        </li>
        <li>
          <strong>We are not a law firm.</strong> We do not give legal, tax or accounting advice, and using the service does not
          create an attorney-client relationship.
        </li>
        <li>
          <strong>Filing yourself is always an option.</strong> A business can file directly with its state and pay only the
          state fee.
        </li>
      </ul>

      <h2>2. The service</h2>
      <p>
        {brand} helps businesses see which filings a state requires, when they are due and what they cost, sends deadline
        reminders, and, when you order it, prepares and submits a specific filing for your business. Today we file annual reports
        in the states marked &ldquo;Supported&rdquo; on our site.
      </p>
      <p>
        Requirement summaries on our site come from official government publications, with links to those sources and the date
        we last reviewed them. They are general information, not advice about your particular situation. Laws and state
        procedures change, and the official source controls if it differs from our summary.
      </p>

      <h2>3. Your account</h2>
      <p>
        You must be at least 18 years old and able to enter into a binding agreement. Keep your sign-in details secure and tell us
        promptly if you think someone else has accessed your account. You are responsible for activity under your account.
      </p>

      <h2>4. Your responsibilities</h2>
      <ul>
        <li>
          You must be authorized to act for each business you add and each filing you order, for example as an owner, officer,
          member, partner or other authorized person.
        </li>
        <li>
          You must give us information that is accurate, complete and current, and review it before you authorize a filing. We
          prepare filings from what you provide. We may compare it with public records, but we do not independently verify all of
          it.
        </li>
        <li>You agree to respond promptly if we or the state need more information to complete the filing.</li>
        <li>
          Deadline reminders are a courtesy. You remain responsible for meeting your business&apos;s filing obligations, including
          filings we do not support.
        </li>
      </ul>

      <h2>5. Authorization to act for your business</h2>
      <p>
        When you order a filing, you authorize {brand} and its personnel to act as your business&apos;s authorized representative
        for the limited purpose of preparing, electronically signing and submitting that specific filing, using the information
        you provided, and paying the state filing fee on your business&apos;s behalf from the amount you pay. This authorization
        covers only that filing. It does not make us your registered agent, and it ends when the filing is completed, cancelled
        or refunded. The exact wording you agree to at checkout is on the{" "}
        <Link href="/legal/filing-authorization">filing authorization</Link> page.
      </p>

      <h2>6. Fees and payment</h2>
      <p>Every order has two parts, shown as separate lines before you pay:</p>
      <ul>
        <li>
          <strong>The state filing fee</strong>, set by the state. We pass it through at cost and pay it to the state on your
          behalf. We do not mark it up.
        </li>
        <li>
          <strong>Our service fee</strong>, for preparing and submitting the filing and keeping your records.
        </li>
      </ul>
      <p>
        Payments are processed by our payment processor. We do not receive or store your full card number. Prices can change,
        but the price shown at checkout is the price for that order.
      </p>

      <h2>7. Refunds</h2>
      <p>
        Refunds are covered by our <Link href="/legal/refunds">refund policy</Link>. In summary: a full refund before we submit to
        the state; after submission the state fee cannot be refunded because the state keeps it; and we refund our service fee if
        we made an error or cannot complete the filing.
      </p>

      <h2>8. State processing is outside our control</h2>
      <p>
        We submit filings within a reasonable time after we have everything we need, and we aim to file before the due date when
        you order with enough time. However, we cannot control state systems, processing times, outages, rejections or changes in
        law, and we cannot guarantee that a state will accept a filing or process it by a particular date. If a state rejects a
        filing, we will tell you why, correct what we can, and ask you for anything we need.
      </p>

      <h2>9. Emails</h2>
      <p>
        We send emails about your account and orders, such as order confirmations and status updates, and deadline reminders for
        businesses you add. You can turn off reminders at any time from the link in any reminder or in your account settings.
        Order-related emails continue while an order is open.
      </p>

      <h2>10. Acceptable use</h2>
      <p>
        Do not use the service to submit false or misleading information, to file for a business you are not authorized to
        represent, to interfere with the service or other users, or to copy or scrape the site in bulk. We may refuse or cancel an
        order that we reasonably believe is unauthorized or fraudulent.
      </p>

      <h2>11. Our content</h2>
      <p>
        The site, its design and our written content belong to {brand}. Government publications we link to belong to their
        publishers.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        Except as stated in these terms, the service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent
        the law allows, we disclaim implied warranties, including merchantability, fitness for a particular purpose and
        non-infringement.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the extent the law allows, {brand} is not liable for indirect, incidental, special, consequential or punitive damages,
        or for lost profits or revenue. Our total liability for any claim relating to the service is limited to the service fees
        you paid us for the filing that gave rise to the claim. State filing fees are paid to the state and are not part of this
        amount. Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <h2>14. Your responsibility to us</h2>
      <p>
        You agree to cover reasonable losses and costs we incur because you provided inaccurate information, ordered a filing you
        were not authorized to order, or broke these terms.
      </p>

      <h2>15. Ending the agreement</h2>
      <p>
        You can stop using the service and close your account at any time. We may suspend or close an account that breaks these
        terms. Orders already in progress are handled under the refund policy. Sections that by their nature should continue,
        such as fees owed, disclaimers and limitation of liability, survive.
      </p>

      <h2>16. Changes to these terms</h2>
      <p>
        We may update these terms. If a change is material, we will tell you by email or on the site before it takes effect. The
        terms in effect when you place an order apply to that order.
      </p>

      <h2>17. Governing law</h2>
      <p>
        These terms are governed by the laws of [State of incorporation], without regard to its conflict-of-law rules. [Dispute
        resolution terms to be confirmed.]
      </p>

      <h2>18. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
