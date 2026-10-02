/** Exactly what a visitor agrees to when opting in to free filing reminders (stored with the subscription). */
export function reminderConsentText(stateName: string, filingName: string): string {
  return `Yes, email me reminders about this business's ${stateName} ${filingName.toLowerCase()}: a confirmation email now, then up to three reminders a year (about 60, 30 and 7 days before the due date). I can unsubscribe at any time.`;
}

export const REMINDER_CONSENT_TEXT = reminderConsentText("Pennsylvania", "Annual Report");
