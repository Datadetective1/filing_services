"use client";

import { CheckCircle, FloppyDisk } from "@phosphor-icons/react";
import { useActionState, useRef, type ReactNode } from "react";
import type { ActionState } from "@/components/admin/action-state";
import { cn } from "@/components/ui/cn";
import { saveOwnerCheckAction } from "./actions";

/**
 * One checklist item: a checkbox that saves as soon as it's ticked, and (where the
 * checklist asks for it) a field for the state's exact response or portal wording.
 */
export function CheckItem({
  itemKey,
  done,
  note,
  noteLabel,
  updated,
  children,
}: {
  itemKey: string;
  done: boolean;
  note: string;
  noteLabel?: string;
  updated?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveOwnerCheckAction, null);
  const id = `oc-${itemKey.replace(/[^a-z0-9]/gi, "-")}`;

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        "grid gap-3 rounded-[var(--radius-control)] border bg-surface p-4 transition-colors",
        done ? "border-accent/40 bg-accent-soft/40" : "border-border",
      )}
    >
      <input type="hidden" name="itemKey" value={itemKey} />
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          name="done"
          defaultChecked={done}
          onChange={() => formRef.current?.requestSubmit()}
          aria-describedby={`${id}-text`}
          className="mt-1 size-5 shrink-0 accent-[var(--accent)]"
        />
        <label htmlFor={id} id={`${id}-text`} className="min-w-0 flex-1 cursor-pointer text-[15px] leading-relaxed text-fg [overflow-wrap:anywhere]">
          <span className="sr-only">Done: </span>
          {children}
        </label>
      </div>
      {noteLabel ? (
        <div className="grid gap-1.5 sm:pl-8">
          <label htmlFor={`${id}-note`} className="text-sm font-medium text-fg">
            {noteLabel}
          </label>
          <textarea
            id={`${id}-note`}
            name="note"
            defaultValue={note}
            maxLength={4000}
            rows={note ? Math.min(8, Math.max(2, note.split("\n").length + 1)) : 2}
            className="min-h-16 w-full rounded-[var(--radius-control)] border border-border-strong bg-bg px-3 py-2 text-[15px] text-fg outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
            placeholder="Record the exact wording or answer"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 text-sm font-semibold text-fg hover:bg-surface-2 disabled:opacity-60"
            >
              <FloppyDisk size={16} aria-hidden />
              {pending ? "Saving..." : "Save"}
            </button>
            <Status state={state} pending={pending} updated={updated} />
          </div>
        </div>
      ) : (
        <div className="sm:pl-8">
          <Status state={state} pending={pending} updated={updated} />
        </div>
      )}
    </form>
  );
}

function Status({ state, pending, updated }: { state: ActionState; pending: boolean; updated?: string }) {
  if (pending) return <span className="text-sm text-muted">Saving...</span>;
  if (state && !state.ok) return <span role="alert" className="text-sm font-medium text-danger">{state.error}</span>;
  if (state?.ok)
    return (
      <span role="status" className="inline-flex items-center gap-1 text-sm text-accent-soft-fg">
        <CheckCircle size={16} weight="fill" aria-hidden />
        Saved
      </span>
    );
  return updated ? <span className="text-xs text-subtle">Last saved {updated}</span> : null;
}
