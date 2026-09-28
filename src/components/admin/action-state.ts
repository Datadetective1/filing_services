/**
 * Result of an operations-console server action, rendered inline by ActionForm.
 * Shared by client forms and "use server" action modules (types only).
 */
export type ActionState =
  | { ok: true; message: string; details?: { label: string; value: string }[] }
  | { ok: false; error: string }
  | null;

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
