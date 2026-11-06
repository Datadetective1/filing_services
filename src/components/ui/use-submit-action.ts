"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionMessageState } from "@/components/funnel/types";

/**
 * Runs a server action from a form's submit event instead of its `action` prop. React resets a
 * form after an `action` prop finishes, which wipes what the customer typed when the server sends
 * back an error and leaves controlled checkboxes showing a different state from the page. Submitting
 * this way keeps every field as it was so the customer can fix the one problem and try again.
 */
export function useSubmitAction(
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>,
): [ActionMessageState, (event: FormEvent<HTMLFormElement>) => void, boolean] {
  const [state, dispatch, pending] = useActionState<ActionMessageState, FormData>(action, {});
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }
  return [state, onSubmit, pending];
}
