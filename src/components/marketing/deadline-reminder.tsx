import { signUpForDeadlineReminder } from "@/app/(marketing)/reminders/signup-actions";
import { DeadlineReminderForm } from "@/components/funnel/deadline-reminder-form";
import type { EntityType } from "@/lib/domain/types";
import { reminderSignupOptions } from "@/lib/reminders/signup-options";

/**
 * The free "remind me before my deadline" box for a state's pages. Renders nothing where
 * we can't compute the due date ourselves (states whose rule isn't verified yet).
 */
export function DeadlineReminder({
  stateCode,
  entityType,
  page,
  title,
  className,
}: {
  stateCode: string;
  entityType?: EntityType;
  page: string;
  title?: string;
  className?: string;
}) {
  const options = reminderSignupOptions(stateCode, entityType);
  if (!options) return null;
  return <DeadlineReminderForm action={signUpForDeadlineReminder} options={options} page={page} title={title} className={className} />;
}
