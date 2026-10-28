import { ActionForm } from "@/components/admin/action-form";
import { Field, Textarea } from "@/components/ui/field";
import { markPaymentReviewedAction } from "./actions";

/**
 * "Mark reviewed" for a payment flagged for review. Render it for admins only; the action
 * checks the admin role again on the server.
 */
export function MarkReviewedForm({ paymentId }: { paymentId: string }) {
  const noteId = `review-note-${paymentId}`;
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer select-none list-none items-center text-sm font-semibold text-accent underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        Mark reviewed
      </summary>
      <ActionForm
        action={markPaymentReviewedAction}
        submitLabel="Mark reviewed"
        pendingLabel="Saving..."
        confirmLabel="I checked this payment in Stripe and nothing more needs doing."
        className="mt-2 min-w-64"
      >
        <input type="hidden" name="paymentId" value={paymentId} />
        <Field label="What you checked" htmlFor={noteId} hint="Kept in the audit log.">
          <Textarea id={noteId} name="note" required maxLength={500} className="min-h-20" />
        </Field>
      </ActionForm>
    </details>
  );
}
