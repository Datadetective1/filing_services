/**
 * Default notification templates (seeded into notification_templates). Plain,
 * product-style emails from a private company. They must never look like a
 * government notice: no seals, no "OFFICIAL NOTICE", no "FINAL WARNING", no
 * threats. Consequences are only mentioned when a published rule supports them.
 *
 * Placeholders: {{company_name}} {{filing_title}} {{state_name}} {{due_date}}
 * {{due_phrase}} {{status_label}} {{brand}} {{amount}} {{confirmation_number}}
 * {{message}}
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
      "Thanks, we received your order and payment of {{amount}} for {{company_name}}'s {{state_name}} {{filing_title}}.\n\n" +
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
      "Your filed report and state receipt are saved in your dashboard.",
    ctaLabel: "Download your documents",
    description: "Sent when the filing is accepted.",
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
    body: "We issued a refund of {{amount}} for {{company_name}}'s {{state_name}} {{filing_title}}. It can take 5 to 10 business days to appear on your statement.",
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
];

export function getDefaultTemplate(key: string): TemplateDef | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key);
}
