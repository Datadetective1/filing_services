import type { Metadata } from "next";
import { site } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `What ${site.name} collects to track filing deadlines and file on your behalf, how it is used and shared, and your choices. We do not sell personal information.`,
  path: "/legal/privacy",
});

export default function PrivacyPage() {
  const brand = site.name;
  return (
    <LegalPage
      title="Privacy policy"
      path="/legal/privacy"
      summary={
        <p>
          We collect what we need to track your business&apos;s filing deadlines and file on its behalf. We do not sell your
          personal information, we do not store card numbers, and our analytics do not store IP addresses.
        </p>
      }
    >
      <h2>Who this covers</h2>
      <p>
        This policy explains how {site.legalEntity} (&ldquo;{brand}&rdquo;, &ldquo;we&rdquo;) handles personal information when
        you visit our website, create an account or order a filing.
      </p>

      <h2>What we collect</h2>
      <h3>Account information</h3>
      <p>
        Your email address, your name if you give it, and your password. Passwords are handled by our authentication provider and
        stored only in hashed form.
      </p>
      <h3>Business record details</h3>
      <p>
        Information about the businesses you add and the filings you order: legal name, state entity number, state and entity
        type, registered and principal office addresses, and the names and titles of governors and officers. Much of this
        information appears on state filings, and once filed it becomes part of the state&apos;s public record.
      </p>
      <h3>Authorization details</h3>
      <p>
        When you authorize a filing, we keep a record of it: the name and title you enter, the authorization wording and its
        version, a snapshot of the information being filed, the time, a salted hash of your IP address, and your browser&apos;s
        user agent string. We keep this to show what was authorized, by whom and when.
      </p>
      <h3>Payment information</h3>
      <p>
        Payments are handled by our payment processor. We receive the payment status, amount and a reference to the transaction.
        We do not receive or store your full card number.
      </p>
      <h3>Messages</h3>
      <p>Messages you send us about an order, and our replies.</p>
      <h3>Analytics</h3>
      <p>
        We use our own first-party analytics to understand which pages and steps work. We record the event (for example, that a
        state page was viewed), the page path without its query string, the state and entity type involved, your account ID if
        you are signed in, and a random ID stored in your browser. We do not store IP addresses or user agents with analytics,
        and we do not use third-party advertising trackers. If your browser sends a Global Privacy Control or Do Not Track
        signal, we do not create the random browser ID.
      </p>
      <h3>Security</h3>
      <p>
        To prevent abuse, we rate limit some requests using a salted hash of your IP address. We do not store the raw IP address.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To show your filing requirements and due dates, and to send reminders.</li>
        <li>To prepare, submit and track filings you order, and to deliver the state&apos;s confirmation to you.</li>
        <li>To take payment, issue refunds and keep required financial records.</li>
        <li>To answer your questions and ask for information we need.</li>
        <li>To keep the service secure, prevent fraud and improve how it works.</li>
      </ul>

      <h2>Emails and your choices</h2>
      <p>
        We send order and account emails, such as confirmations and status updates, and deadline reminders for businesses you add.
        You can turn off reminders at any time using the unsubscribe link in any reminder or in your account settings. Emails
        about an open order continue until it is finished, because they are part of the service you ordered.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>The state.</strong> When you order a filing, we submit the filing information to the state agency. That is the
          purpose of the service.
        </li>
        <li>
          <strong>Service providers</strong> that run parts of the service for us under contract: hosting, database and
          authentication, email delivery, and payment processing. [Provider list to be confirmed.] They may use the information
          only to provide their services to us.
        </li>
        <li>
          <strong>Legal reasons.</strong> When required by law, or to protect the rights, safety and security of our users, the
          public or {brand}.
        </li>
        <li>
          <strong>Business transfers.</strong> If {brand} is involved in a merger, acquisition or sale of assets, subject to this
          policy.
        </li>
      </ul>
      <p>We do not sell personal information, and we do not share it for cross-context behavioral advertising.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep account information while your account is open. We keep filing, authorization and payment records for [retention
        period to be confirmed] after a filing is completed, to meet legal, tax and record-keeping obligations and to answer
        questions about past filings. Analytics events are kept for [retention period to be confirmed]. When information is no
        longer needed, we delete it or de-identify it.
      </p>

      <h2>How we protect it</h2>
      <p>
        Data is encrypted in transit. Customer records are protected by database access rules so each account can read only its
        own data. Filing documents are kept in private storage and shared through short-lived links. Staff access is limited to
        people who need it to fulfill filings, and actions are logged. No system is perfectly secure, but we work to protect your
        information and will notify you of a breach as the law requires.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, delete or get a copy of your personal information,
        and to opt out of certain uses. We honor Global Privacy Control signals. To make a request, email{" "}
        <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. We will verify your identity before acting on a request
        and will not treat you differently for making one. We cannot remove information from a state&apos;s public record once a
        filing has been accepted by the state.
      </p>

      <h2>Children</h2>
      <p>The service is for adults acting for businesses. It is not directed to anyone under 18.</p>

      <h2>Changes</h2>
      <p>
        We will post any changes here and update the date at the top. If a change is material, we will tell you by email or on the
        site before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions and requests: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
