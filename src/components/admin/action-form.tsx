"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/components/ui/cn";
import type { ActionState, FormAction } from "./action-state";
import { opsButton } from "./button-classes";

// Mirrors MAX_DOCUMENT_BYTES (server-only module); Vercel caps request bodies at 4.5 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function isNextSignal(error: unknown): boolean {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "";
  return digest.startsWith("NEXT_");
}

/**
 * A server-action form for the operations console. Shows the action's result
 * (success or OperationError text) inline, keeps what the operator typed when the
 * action fails, and clears the form after success.
 *
 * `confirmLabel` adds a required confirmation checkbox (destructive actions).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Working...",
  variant = "secondary",
  confirmLabel,
  resetOnSuccess = true,
  className,
  fullWidthSubmit = false,
}: {
  action: FormAction;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirmLabel?: string;
  resetOnSuccess?: boolean;
  className?: string;
  fullWidthSubmit?: boolean;
}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    for (const value of formData.values()) {
      if (value instanceof File && value.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Files must be 4 MB or smaller." };
    }
    try {
      return await action(prev, formData);
    } catch (error) {
      // Let Next.js navigation signals (redirect, not found) through untouched.
      if (isNextSignal(error)) throw error;
      return {
        ok: false,
        error: "The request did not complete. Check your connection and try again. Very large files can exceed the upload limit.",
      };
    }
  }, null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusId = useId();
  const confirmId = useId();

  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className={cn("grid gap-3", className)} aria-describedby={state ? statusId : undefined}>
      {children}
      {confirmLabel ? (
        <label htmlFor={confirmId} className="flex min-h-11 items-start gap-2.5 text-sm text-fg">
          <input
            id={confirmId}
            type="checkbox"
            name="confirm"
            value="yes"
            required
            className="mt-0.5 size-5 shrink-0 rounded border-border-strong accent-[var(--accent)]"
          />
          <span>{confirmLabel}</span>
        </label>
      ) : null}
      <div>
        <button type="submit" disabled={pending} aria-busy={pending} className={opsButton(variant, fullWidthSubmit ? "w-full" : undefined)}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
      <div id={statusId} aria-live="polite">
        {state && !state.ok ? (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
            <WarningCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden />
            <span>{state.error}</span>
          </p>
        ) : null}
        {state && state.ok ? (
          <div className="grid gap-1.5 rounded-[var(--radius-control)] bg-accent-soft px-3 py-2.5 text-sm">
            <p className="flex items-start gap-2 font-semibold text-accent-soft-fg">
              <CheckCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden />
              <span>{state.message}</span>
            </p>
            {state.details?.length ? (
              <dl className="tnum grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-[26px] text-muted">
                {state.details.map((d) => (
                  <div key={d.label} className="contents">
                    <dt>{d.label}</dt>
                    <dd className="text-fg">{d.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
