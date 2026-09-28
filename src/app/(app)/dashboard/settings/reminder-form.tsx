"use client";

import { Bell, BellSlash } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { setReminderEmailsAction, type ReminderState } from "./actions";

export function ReminderForm({ enabled: initialEnabled }: { enabled: boolean }) {
  const [state, action] = useActionState<ReminderState, FormData>(setReminderEmailsAction, undefined);
  const enabled = state?.ok && typeof state.enabled === "boolean" ? state.enabled : initialEnabled;
  const Icon = enabled ? Bell : BellSlash;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
      {state?.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={
            enabled
              ? "grid size-10 shrink-0 place-content-center rounded-[var(--radius-control)] bg-accent-soft text-accent-soft-fg"
              : "grid size-10 shrink-0 place-content-center rounded-[var(--radius-control)] bg-surface-2 text-muted"
          }
        >
          <Icon size={20} />
        </span>
        <div className="grid gap-1">
          <p className="font-medium text-fg" role="status" aria-live="polite">
            Deadline reminders are {enabled ? "on" : "off"}
          </p>
          <p className="text-sm text-muted">
            {enabled
              ? "We email you ahead of each filing deadline for the businesses you track."
              : "You won't get emails about upcoming deadlines. You can turn them back on at any time."}
          </p>
        </div>
      </div>
      <div>
        <SubmitButton variant="secondary" className="min-h-11" pendingLabel="Saving…">
          {enabled ? "Turn off reminders" : "Turn on reminders"}
        </SubmitButton>
      </div>
    </form>
  );
}
