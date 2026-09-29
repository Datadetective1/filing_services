"use client";

import { Bell, BellSlash } from "@phosphor-icons/react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/components/ui/cn";
import { Notice } from "@/components/ui/surface";
import { setReminderEmailsAction, type ReminderState } from "./actions";

/** A switch that submits its form: the server flips the preference, then the switch follows. */
function ReminderSwitch({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={enabled}
      aria-label="Deadline reminder emails"
      aria-describedby="reminders-description"
      aria-busy={pending}
      disabled={pending}
      className="group inline-flex h-11 shrink-0 items-center rounded-full px-0.5 disabled:cursor-wait"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-8 w-[56px] rounded-full transition-colors duration-200",
          enabled ? "bg-accent group-hover:bg-accent-hover" : "bg-subtle group-hover:bg-muted",
          pending && "opacity-70",
        )}
      >
        <span
          className={cn(
            "absolute left-1 top-1 size-6 rounded-full bg-white shadow-[0_1px_3px_rgb(23_35_29/0.3)] transition-transform duration-200",
            enabled ? "translate-x-6" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

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
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            enabled ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
          )}
        >
          <Icon size={19} weight="fill" />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="font-semibold text-fg" role="status" aria-live="polite">
            Deadline reminders are {enabled ? "on" : "off"}
          </p>
          <p id="reminders-description" className="text-sm leading-6 text-muted">
            {enabled
              ? "We email you ahead of each filing deadline for the businesses you track."
              : "You won't get emails about upcoming deadlines. You can turn them back on at any time."}
          </p>
        </div>
        <ReminderSwitch enabled={enabled} />
      </div>
    </form>
  );
}
