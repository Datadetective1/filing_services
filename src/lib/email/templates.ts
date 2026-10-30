/**
 * Default notification templates (seeded into notification_templates). Plain,
 * product-style emails from a private company. They must never look like a
 * government notice: no seals, no "OFFICIAL NOTICE", no "FINAL WARNING", no
 * threats. Consequences are only mentioned when a published rule supports them.
 *
 * Placeholders: {{company_name}} {{filing_title}} {{state_name}} {{due_date}}
 * {{due_phrase}} {{status_label}} {{brand}} {{amount}} {{government_fee}}
 * {{service_fee}} {{payment_mode}} {{confirmation_number}} {{message}}
 * document_ready: {{businessName}} {{filingName}} {{documentLabel}}
 *
 * Money: the state's fee and our service fee are always separate lines, and the
 * service fee is never described as a government fee.
 */

export type TemplateCategory = "reminder" | "transactional";

export interface TemplateDef {
  key: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  ctaLabel: string | null;
  description: string;
}

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  {
    key: "reminder_upcoming",
    category: "reminder",
    subject: "Your {{state_name}} {{filing_title}} is due {{due_phrase}}",
    body:
      "{{company_name}}'s {{state_name}} {{filing_title}} is due {{due_phrase}}, on {{due_date}}.\n\n" +
      "{{filing_options}}",
    ctaLabel: "Review your filing",
    description: "Deadline reminder before the due date (no order placed yet).",
  },
  {
    key: "reminder_due_today",
    category: "reminder",
    subject: "Your {{state_name}} {{filing_title}} is due today",
    body:
      "{{company_name}}'s {{state_name}} {{filing_title}} is due today, {{due_date}}.\n\n" +
      "If you've already filed it, you can mark it as filed and we'll stop reminding you.",
    ctaLabel: "Review your filing",
    description: "Reminder on the due date.",
  },
  {
    key: "reminder_overdue",
    category: "reminder",
    subject: "Your {{state_name}} {{filing_title}} was due {{due_phrase}}",
    body:
      "{{company_name}}'s {{state_name}} {{filing_title}} was due on {{due_date}}. According to our records it hasn't been filed yet.\n\n" +
      "It can still be filed. If you've already filed it, mark it as filed and we'll stop reminding you.",
    ctaLabel: "Review your filing",
    description: "Reminder after the due date.",
  },
  {
    key: "reminder_needs_information",
    category: "reminder",
    subject: "We still need information to complete your filing",
    body:
      "We're preparing {{company_name}}'s {{state_name}} {{filing_title}} (due {{due_date}}), but we still need a few details from you before we can file it.",
    ctaLabel: "Add the missing details",
    description: "Reminder when an order is waiting on customer information.",
  },
  {
    key: "order_confirmed",
    category: "transactional",
    subject: "Order confirmed: {{state_name}} {{filing_title}} for {{company_name}}",
    body:
      "Thanks, we received your order and payment for {{company_name}}'s {{state_name}} {{filing_title}}.\n\n" +
      "Government filing fee (paid to {{state_name}}, passed through at cost): {{government_fee}}\n" +
      "Our service fee: {{service_fee}}\n" +
      "Total paid: {{amount}}\n\n" +
      "Next, we review your information and prepare the filing. We'll email you when it's submitted and when the state accepts it.",
    ctaLabel: "Track your filing",
    description: "Sent when payment succeeds.",
  },
  {
    key: "payment_failed",
    category: "transactional",
    subject: "Your payment didn't go through",
    body:
      "We couldn't complete the payment for {{company_name}}'s {{state_name}} {{filing_title}}. No filing has been started.\n\nYou can try again from your dashboard.",
    ctaLabel: "Try again",
    description: "Sent when a checkout payment fails.",
  },
  {
    key: "information_requested",
    category: "transactional",
    subject: "Action needed: {{state_name}} {{filing_title}} for {{company_name}}",
    body: "We need something from you to continue {{company_name}}'s filing:\n\n{{message}}",
    ctaLabel: "Reply in your dashboard",
    description: "Sent when an operator requests information.",
  },
  {
    key: "filing_submitted",
    category: "transactional",
    subject: "Submitted: {{state_name}} {{filing_title}} for {{company_name}}",
    body:
      "We submitted {{company_name}}'s {{state_name}} {{filing_title}} to the state. Confirmation number: {{confirmation_number}}.\n\nWe'll let you know as soon as it's accepted.",
    ctaLabel: "View filing",
    description: "Sent when an operator marks the filing submitted.",
  },
  {
    key: "filing_accepted",
    category: "transactional",
    subject: "Your filing was accepted: {{state_name}} {{filing_title}}",
    body:
      "Good news: the state accepted {{company_name}}'s {{state_name}} {{filing_title}}. Confirmation number: {{confirmation_number}}.\n\n" +
      "The state's confirmation is saved in your dashboard, where you can view and download it.",
    ctaLabel: "View filing",
    // Sent only once a customer-visible state receipt, filed report or acknowledgement
    // is on file (operations.ts completeIfReceiptOnFile), so the confirmation is already there.
    description: "Sent when the filing is accepted and the state's confirmation is in the dashboard.",
  },
  {
    key: "filing_rejected",
    category: "transactional",
    subject: "Update on your {{state_name}} {{filing_title}}",
    body:
      "The state didn't accept {{company_name}}'s {{state_name}} {{filing_title}} as submitted.\n\nReason: {{message}}\n\nWe'll follow up with next steps.",
    ctaLabel: "View filing",
    description: "Sent when the state rejects the filing.",
  },
  {
    key: "refund_issued",
    category: "transactional",
    subject: "Refund issued: {{amount}}",
    body:
      "We issued a refund for {{company_name}}'s {{state_name}} {{filing_title}}.\n\n" +
      "Government filing fee refunded: {{government_fee}}\n" +
      "Service fee refunded: {{service_fee}}\n" +
      "Total refunded: {{amount}}\n\n" +
      "It can take 5 to 10 business days to appear on your statement.",
    ctaLabel: "View order",
    description: "Sent when a refund succeeds.",
  },
  {
    key: "filing_cancelled",
    category: "transactional",
    subject: "Cancelled: {{state_name}} {{filing_title}} for {{company_name}}",
    body: "Your order for {{company_name}}'s {{state_name}} {{filing_title}} was cancelled. {{message}}",
    ctaLabel: "View order",
    description: "Sent when a filing is cancelled.",
  },
  {
    key: "document_ready",
    category: "transactional",
    subject: "Your {{filingName}} document is ready",
    body:
      "We added a document to {{businessName}}'s {{filingName}}: {{documentLabel}}.\n\n" +
      "You can view and download it from your dashboard.",
    ctaLabel: "View document",
    description: "Sent when a customer-visible document is added to a filing.",
  },
  {
    key: "staff_new_paid_order",
    category: "transactional",
    subject: "New paid order: {{company_name}} ({{state_name}} {{filing_title}})",
    body:
      "A new order was paid for {{company_name}}'s {{state_name}} {{filing_title}}, due {{due_date}}.\n\n" +
      "Filing ID: {{filing_id}}\n" +
      "Government filing fee: {{government_fee}}\n" +
      "Service fee: {{service_fee}}\n" +
      "Total paid: {{amount}}\n" +
      "Payment mode: {{payment_mode}}\n\n" +
      "Review it in the admin console.",
    ctaLabel: "Open filing",
    description: "Staff alert: a customer's payment succeeded.",
  },
  {
    key: "staff_customer_message",
    category: "transactional",
    subject: "Customer message: {{company_name}} ({{state_name}} {{filing_title}})",
    body:
      "The customer sent a message about {{company_name}}'s {{state_name}} {{filing_title}}. Filing status: {{status_label}}.\n\n" +
      "Read and reply in the admin console. You get at most one of these alerts per filing each hour, so read the whole thread.",
    ctaLabel: "Open filing",
    description: "Staff alert: a customer posted a message on a filing (at most one alert per filing per hour).",
  },
  {
    key: "staff_payment_review",
    category: "transactional",
    subject: "Payment needs review: {{company_name}}",
    body:
      "A payment of {{amount}} for {{company_name}} is flagged for review: {{review_reason}}.\n\n" +
      "Payment mode: {{payment_mode}}\n\n" +
      "Check it in the admin console (Payments, Needs review) before filing or refunding. You get one of these emails for each flagged payment once a day until an admin marks it reviewed.",
    ctaLabel: "Open payment",
    description: "Staff alert: a payment flagged for review (daily, one per flagged payment).",
  },
  {
    key: "staff_email_test",
    category: "transactional",
    subject: "Filewell production email test",
    body:
      "This is a production delivery test. No filing was submitted and no payment was processed.\n\n" +
      "It was sent from the admin console (Emails page) to the staff member who requested it.",
    ctaLabel: null,
    description: "Staff-requested delivery test sent to the requesting staff member only.",
  },
  // -------------------------------------------------------------------------
  // Business services (registered agent, bundle, formation)
  // Placeholders: {{company_name}} {{state_name}} {{service_name}} {{amount}}
  // {{government_fee}} {{service_fee}} {{renewal_amount}} {{renewal_date}} {{document_label}}
  // {{days}} {{message}} {{payment_mode}} {{order_ref}}
  // No delivery time is ever promised in these emails.
  // -------------------------------------------------------------------------
  {
    key: "service_order_confirmed",
    category: "transactional",
    subject: "Order received: {{service_name}} for {{company_name}}",
    body:
      "Thanks. We received your order for {{service_name}} in {{state_name}} for {{company_name}}.\n\n" +
      "Paid to the state: {{government_fee}}\n" +
      "Filewell service: {{service_fee}}\n" +
      "Total paid today: {{amount}}\n\n" +
      "Your service is not active yet. We check your details, place the order with our registered agent provider and confirm the appointment before we tell you it is active. If we need anything from you, we'll ask in your dashboard.",
    ctaLabel: "See your order",
    description: "Sent when a business services checkout is paid.",
  },
  {
    key: "service_active",
    category: "transactional",
    subject: "Active: registered agent service for {{company_name}} in {{state_name}}",
    body:
      "Your registered agent service for {{company_name}} in {{state_name}} is now active. The agent's name and address are in your dashboard.\n\n" +
      "When legal documents or government notices arrive for your business, we add them to your dashboard and email you. We send every notice to the email address on your account, so please keep it and your phone number up to date.",
    ctaLabel: "Open your dashboard",
    description: "Sent when an operator confirms a registered agent appointment with evidence.",
  },
  {
    key: "service_filing_completed",
    category: "transactional",
    subject: "Done: {{service_name}} for {{company_name}}",
    body: "The state accepted the {{service_name}} filing for {{company_name}} in {{state_name}}. The confirmation is in your dashboard.",
    ctaLabel: "View confirmation",
    description: "Sent when an operator records a completed change of agent or formation filing.",
  },
  {
    key: "service_information_requested",
    category: "transactional",
    subject: "Action needed: {{service_name}} for {{company_name}}",
    body: "We need something from you to continue {{company_name}}'s {{service_name}} order:\n\n{{message}}",
    ctaLabel: "Reply in your dashboard",
    description: "Sent when an operator needs information for a business services order.",
  },
  {
    key: "ra_document_urgent",
    category: "transactional",
    subject: "Legal document received for {{company_name}}",
    body:
      "Your registered agent received a {{document_label}} for {{company_name}} in {{state_name}}. It may start a legal deadline, so please read it today.\n\n" +
      "Open your dashboard to view and download it. If you have a lawyer, send it to them.",
    ctaLabel: "View the document",
    description: "Urgent: service of process received. Staff may also call where the customer gave a number.",
  },
  {
    key: "ra_document_received",
    category: "transactional",
    subject: "New {{document_label}} for {{company_name}}",
    body: "Your registered agent received a {{document_label}} for {{company_name}} in {{state_name}}. You can view and download it from your dashboard.",
    ctaLabel: "View the document",
    description: "Sent when a government notice, mail item or other document is added for a registered agent customer.",
  },
  {
    key: "ra_document_arriving",
    category: "transactional",
    subject: "A new document arrived for {{company_name}}",
    body:
      "Your registered agent received a new document for {{company_name}} in {{state_name}}. We're adding it to your dashboard now, and we'll email you again as soon as you can view it.",
    ctaLabel: "Open your service",
    description: "Sent when the registered agent partner tells us a document arrived, before staff have added the file.",
  },
  {
    key: "ra_renewal_reminder",
    category: "transactional",
    subject: "Your registered agent service renews in {{days}} days",
    body:
      "Your {{service_name}} for {{company_name}} in {{state_name}} renews on {{renewal_date}} for {{renewal_amount}}, charged to the card on file.\n\n" +
      "If you no longer need it, you can turn off renewal in your dashboard before that date. Turning off renewal doesn't change the state's record: if you stop using us as your registered agent, you need to name a new agent with the state.",
    ctaLabel: "Manage your service",
    description: "Sent 30 and 7 days before a registered agent subscription renews.",
  },
  {
    key: "ra_payment_failed",
    category: "transactional",
    subject: "Your registered agent payment didn't go through",
    body:
      "We couldn't charge the renewal for {{company_name}}'s {{service_name}} in {{state_name}}. Your service has not been cancelled. We'll try the card again, or you can update it from your dashboard.",
    ctaLabel: "Update payment",
    description: "Sent when a registered agent renewal payment fails. Service is never ended because of one failure.",
  },
  {
    key: "ra_renewal_cancelled",
    category: "transactional",
    subject: "Renewal turned off: {{company_name}} in {{state_name}}",
    body:
      "Your {{service_name}} for {{company_name}} will not renew. It stays in place until {{renewal_date}}.\n\n" +
      "Before then, name a new registered agent with the state. If we are still listed as your agent after the service ends, our provider may file a resignation with the state, which can cost you good standing.\n\n" +
      "After the service ends, documents sent to the old agent address are no longer forwarded to you. Please don't set up USPS mail forwarding from that address.",
    ctaLabel: "Manage your service",
    description: "Sent when a customer turns off renewal.",
  },
  {
    key: "staff_new_service_order",
    category: "transactional",
    subject: "New paid service order: {{company_name}} ({{state_name}} {{service_name}})",
    body:
      "A business services order was paid for {{company_name}} in {{state_name}}: {{service_name}}.\n\n" +
      "Order: {{order_ref}}\n" +
      "Paid to the state: {{government_fee}}\n" +
      "Filewell service: {{service_fee}}\n" +
      "Total paid: {{amount}}\n" +
      "Payment mode: {{payment_mode}}\n\n" +
      "Work it in the admin console (Registered agent). Nothing is active until you record the provider's confirmation.",
    ctaLabel: "Open the queue",
    description: "Staff alert: a business services payment succeeded.",
  },
  {
    key: "staff_ra_billing_review",
    category: "transactional",
    subject: "Billing review: {{company_name}} registered agent in {{state_name}}",
    body:
      "Billing for {{company_name}}'s registered agent service in {{state_name}} needs a person: {{message}}.\n\n" +
      "Nothing has been sent to the provider or the state. Contact the customer before asking the provider to end service.",
    ctaLabel: "Open the subscription",
    description: "Staff alert: repeated failed renewals, or a subscription that ended.",
  },
  {
    key: "staff_ra_document_escalation",
    category: "transactional",
    subject: "Escalation: {{document_label}} for {{company_name}} not yet delivered",
    body:
      "A {{document_label}} for {{company_name}} has not reached the customer within the internal target. Escalation level: {{message}}.\n\n" +
      "Notify the customer now and record the attempt.",
    ctaLabel: "Open the document",
    description: "Staff alert: an urgent or high-priority registered agent document is past its internal target.",
  },
  {
    key: "staff_ra_partner_document",
    category: "transactional",
    subject: "Partner document for {{company_name}} ({{state_name}})",
    body:
      "Registered Agents Inc. reports a new document for {{company_name}}.\n\n" +
      "Partner document ID: {{provider_document_id}}\nPartner company ID: {{provider_company_id}}\n\n" +
      "{{message}}",
    ctaLabel: "Open registered agent",
    description: "Staff alert: the registered agent partner reported a new document, which staff must pull from the partner portal and upload.",
  },
];

export function getDefaultTemplate(key: string): TemplateDef | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
