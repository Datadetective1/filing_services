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
      "You can file it yourself on the state's website, or have {{brand}} prepare and submit it for you.",
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
];

export function getDefaultTemplate(key: string): TemplateDef | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
