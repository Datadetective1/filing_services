"use client";

import { useActionState } from "react";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ReplyState } from "@/app/(app)/dashboard/actions";

/** Reply box under a filing's message thread. The filing id is bound on the server. */
export function ReplyForm({
  action,
}: {
  action: (prev: ReplyState, formData: FormData) => Promise<ReplyState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const fieldError = state?.fieldError;
  return (
    <form action={formAction} className="grid gap-3" noValidate>
      {state?.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success" role="status" key={state.sentAt}>
          Message sent. Our reply will appear in this thread.
        </Notice>
      ) : null}
      <Field label="Write a message" htmlFor="reply-body" hint="Up to 5,000 characters." error={fieldError}>
        <Textarea
          id="reply-body"
          name="body"
          rows={4}
          maxLength={5000}
          required
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "reply-body-error" : "reply-body-hint"}
        />
      </Field>
      <div>
        <SubmitButton className="min-h-11" pendingLabel="Sending…">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
