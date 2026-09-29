"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import { useActionState } from "react";
import { FieldError, Label, Textarea } from "@/components/ui/field";
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
    <form
      action={formAction}
      className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(23_35_29/0.04)] sm:p-5"
      noValidate
    >
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
      <Label htmlFor="reply-body">Write a message</Label>
      <Textarea
        id="reply-body"
        name="body"
        rows={4}
        maxLength={5000}
        required
        placeholder="Ask a question or share an update about this filing."
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? "reply-body-error" : "reply-body-hint"}
      />
      <FieldError id="reply-body-error">{fieldError}</FieldError>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p id="reply-body-hint" className="text-sm text-muted">
          Up to 5,000 characters.
        </p>
        <SubmitButton className="w-full sm:w-auto" pendingLabel="Sending…">
          Send message
          <PaperPlaneRight size={16} weight="fill" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}
