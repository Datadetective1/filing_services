import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { businessServicesIndexable, businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { PROVIDER_LEGAL_NAME } from "@/lib/services/catalog";
import { governingLawText, legalEntityText, postalAddressText } from "@/lib/seo/legal";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

/** Bump whenever the text below changes. */
const BUSINESS_SERVICES_TERMS_UPDATED = "2026-10-29";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Business services terms",
    description: `Terms for ${site.name}'s registered agent, change of agent, formation and registered agent plus annual report services.`,
    path: "/legal/business-services",
    noindex: !businessServicesIndexable(),
  });
}

/**
 * Terms for registered agent, change of agent, formation and the bundle. They never promise
 * more than the registered agent provider promises Filewell: no delivery time, no weekend
 * handling, liability capped at a year of fees. Keep them in step with the provider agreement.
 */
export default function BusinessServicesTermsPage() {
  if (!businessServicesPagesEnabled()) notFound();
  const brand = site.name;
  const entity = legalEntityText();
  const governingLaw = governingLawText();
  return (
    <LegalPage
      title="Business services terms"
      path="/legal/business-services"
      draftNotice={false}
      lastUpdated={BUSINESS_SERVICES_TERMS_UPDATED}
      summary={
        <p>
          These terms cover registered agent service, changing your registered agent, business formation and the registered agent
          plus annual report plan. They add to our <Link href="/legal/terms">terms of service</Link>, which also apply.
        </p>
      }
    >
      <h2>1. Who you contract with</h2>
      <p>
        These terms are an agreement between you and {entity} (&ldquo;{brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). You
        contract with the company, not with any of its owners or staff personally.
      </p>

      <h2>2. Our registered agent provider</h2>
      <p>
        We provide registered agent service through a wholesale provider, {PROVIDER_LEGAL_NAME}. Its name and address appear on the
        state&apos;s records as your registered agent. You deal with {brand} for everything: orders, billing, support and the
        documents you receive. We may change providers. If that needs a state filing, we will tell you first.
      </p>

      <h2>3. What registered agent service includes</h2>
      <p>
        For each business and state you order, our provider receives service of process (lawsuits) and official government notices
        at its address in that state. We add what we receive to your dashboard and email you.
      </p>
      <ul>
        <li>Legal documents and government notices are always included.</li>
        <li>
          Ordinary mail that is not junk is scanned. A limited number of items is included each service year, and further items
          may carry a per item charge that we show you before you are charged.
        </li>
        <li>Packages and verification mail from online services are not accepted. Physical copies are available on request only for a limited time.</li>
      </ul>

      <h2>4. Timing</h2>
      <p>
        Our provider makes documents available to us as they are received and processed. We usually add a document to your
        dashboard and email you within one business day after it reaches us. That is a goal, not a promise, and we do not
        guarantee any delivery time.
      </p>
      <p>
        Business days are Monday to Friday, except US federal holidays. Documents that reach us on a weekend or holiday are
        handled from the next business day. We may also try to call you about a legal document, but we do not promise to.
      </p>

      <h2>5. Notices to you</h2>
      <p>
        We send notices to the email address on your account and, when we call, to the phone number you gave us. A notice is
        delivered when we post it to your dashboard and send the email, whether or not you open it.
      </p>
      <p>
        You must keep your email address, phone number, contact person and address current, and check your email and dashboard.
        We are not responsible for a notice you miss because your contact details were wrong or out of date, or because our email
        was filtered, blocked or not read.
      </p>

      <h2>6. Your responsibilities</h2>
      <ul>
        <li>Give us accurate, complete information about your business and its contact person, and keep it up to date.</li>
        <li>
          Answer promptly when we ask for contact or ownership details. Our provider may need them at short notice to meet legal
          requirements.
        </li>
        <li>Read what we send you and act on it in time. If you receive a lawsuit or legal document, contact a lawyer.</li>
        <li>Use the agent&apos;s address only for what the service allows, and do not set up USPS or other mail forwarding from it.</li>
        <li>Make sure you are authorized to act for the business you order for.</li>
      </ul>

      <h2>7. Change of agent and formation filings</h2>
      <p>
        We prepare and submit change of agent and formation filings from the answers you give and confirm, and pay the state&apos;s
        fee for you. The state decides whether and when to accept a filing. We do not guarantee approval or timing, and we do
        not advise on entity choice, tax treatment or legal structure. Registered agent service starts only when the appointment is
        confirmed and, for a switch, when the state&apos;s record shows the change.
      </p>

      <h2>8. Renewal</h2>
      <p>
        Registered agent service and the registered agent plus annual report plan renew automatically every year at the published
        price shown before you paid, charged to your payment method on file, until you turn off renewal. We email you before each
        renewal. If the price is going to change, we tell you before the renewal it applies to. You can turn off renewal from your
        dashboard at any time before the renewal date, and your service continues until the end of the year you paid for.
      </p>

      <h2>9. Ending the service</h2>
      <p>
        Before your service ends, you must name a new registered agent with the state. After it ends, documents are no longer
        forwarded to you. If we are still listed after the service ends, our provider may resign as your agent with the state,
        which can cause your business to fall out of good standing.
      </p>
      <p>
        Our staff review every cancellation before we end service with our provider. Nothing is cancelled with the provider
        automatically.
      </p>
      <p>
        We may end the service for non-payment, misuse of the agent&apos;s address, false information, or if our provider stops
        providing it. We will give you as much notice as we reasonably can and tell you how to name a new agent.
      </p>

      <h2>10. Refunds</h2>
      <ul>
        <li>
          <strong>Registered agent service.</strong> If you cancel before the appointment is confirmed, we refund what you paid,
          less any state fee already paid. After service starts, the yearly fee is not refunded for the unused part of the year,
          except where the law requires it.
        </li>
        <li>
          <strong>Change of agent and formation.</strong> A full refund before we submit to the state. After we submit, the state
          keeps its fee, and we refund our service fee only if we made an error or could not complete the filing.
        </li>
        <li>
          <strong>Registered agent plus annual report plan.</strong> The yearly fee is not refunded once the included annual report
          has been filed.
        </li>
      </ul>

      <h2>11. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, our total liability to you for all claims arising from business services, whatever
        the cause, is limited to the service fees you paid us for the affected service in the 12 months before the event that gave
        rise to the claim. State fees we pass through are not service fees.
      </p>
      <p>
        To the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential or punitive
        damages, or for lost profits, revenue, data or goodwill. This includes default judgments, penalties, late fees and loss of
        good standing, including where a document reached you late or not at all.
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You agree to defend, indemnify and hold harmless {entity}, its owners, staff and providers from claims, losses and costs,
        including reasonable attorneys&apos; fees, arising from your business and its activities, information you gave us that was
        inaccurate or incomplete, your use of the agent&apos;s address, or your breach of these terms.
      </p>

      <h2>13. Not legal advice</h2>
      <p>
        {brand} is not a law firm and does not give legal, tax or financial advice. We are not affiliated with any government
        agency. You can file changes and formations directly with the state for the state fee alone.
      </p>

      <h2>14. Your information</h2>
      <p>
        For business services we collect your business&apos;s details, a contact person&apos;s name, address and phone number, and, in
        some states, the names and addresses of its owners. We share them with our provider so it can act as your agent and meet
        legal requirements, and with the state as its filings require. Documents received for your business are kept in private
        storage and shown only to you and our staff. Our <Link href="/legal/privacy">privacy policy</Link> also applies.
      </p>

      <h2>15. Changes and contact</h2>
      <p>
        We may update these terms. We will email you about a change that affects a service you pay for before your next renewal.
        {governingLaw ? ` These terms are governed by the laws of ${governingLaw}.` : ""} Questions: {site.supportEmail}. Legal
        notices: {postalAddressText()}.
      </p>
    </LegalPage>
  );
}
