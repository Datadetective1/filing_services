export const ANALYTICS_EVENTS = [
  "landing_viewed",
  "state_page_viewed",
  "lookup_started",
  "lookup_completed",
  "filing_cta_clicked",
  "intake_started",
  "intake_completed",
  "checkout_started",
  "checkout_cancelled",
  "payment_completed",
  "reminder_clicked",
  "filing_completed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEvent(v: unknown): v is AnalyticsEvent {
  return typeof v === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(v);
}

/** Funnel order shown in the admin dashboard. */
export const FUNNEL_STEPS: { event: AnalyticsEvent; label: string }[] = [
  { event: "landing_viewed", label: "Landing page" },
  { event: "state_page_viewed", label: "State page viewed" },
  { event: "lookup_started", label: "Lookup started" },
  { event: "lookup_completed", label: "Lookup completed" },
  { event: "filing_cta_clicked", label: "“Have us file it” clicked" },
  { event: "intake_started", label: "Intake started" },
  { event: "intake_completed", label: "Intake completed" },
  { event: "checkout_started", label: "Checkout started" },
  { event: "payment_completed", label: "Payment completed" },
  { event: "filing_completed", label: "Filing completed" },
];
