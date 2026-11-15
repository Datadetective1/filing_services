import { signUpForDeadlineReminder } from "@/app/(marketing)/reminders/signup-actions";
import { DeadlineReminderForm } from "@/components/funnel/deadline-reminder-form";
import { Container } from "@/components/ui/surface";
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

/** The same box as its own band, for state pages that have no due-date section to hold it. */
export function DeadlineReminderBand({ stateCode, page }: { stateCode: string; page: string }) {
  if (!reminderSignupOptions(stateCode)) return null;
  return (
    <section id="reminder" aria-label="Free deadline reminder" className="scroll-mt-24 pb-10 pt-2 sm:pb-14">
      <Container>
        <DeadlineReminder stateCode={stateCode} page={page} className="max-w-xl" />
      </Container>
    </section>
  );
}
