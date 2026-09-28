"use client";

import Link from "next/link";
import { type ReactNode, useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionMessageState } from "./types";

/**
 * A single-button form bound to a server action (continue, pay). Shows the
 * action's error message, if any, above the button.
 */
export function ActionForm({
  action,
  label,
  pendingLabel,
  hidden,
  errorTitle = "We couldn't continue",
  className,
  footer,
}: {
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>;
  label: ReactNode;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  errorTitle?: string;
  className?: string;
  footer?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "grid gap-4"}>
      {hidden ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      {state.error ? (
        <Notice tone="danger" role="alert" title={errorTitle}>
          <p>{state.error}</p>
          {state.href ? (
            <p className="mt-2">
              <Link href={state.href} className="font-medium text-fg underline underline-offset-4">
                {state.hrefLabel ?? "Continue"}
              </Link>
            </p>
          ) : null}
        </Notice>
      ) : null}
      <SubmitButton size="lg" pendingLabel={pendingLabel} className="w-full">
        {label}
      </SubmitButton>
      {footer}
    </form>
  );
}
