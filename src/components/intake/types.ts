/**
 * Shapes shared by the intake server actions and their client forms. Plain types
 * only, so both sides can import this module.
 */

export type FieldErrorMap = Record<string, string>;

export interface IntakeFormState {
  /** Per-field errors keyed by dotted path, e.g. "principal_office.postal_code" or "governors". */
  errors: FieldErrorMap;
  /** A form-level problem that isn't tied to one field. */
  formError?: string;
  /** What the customer submitted, so nothing they typed is lost on an error. */
  values?: Record<string, unknown>;
  /** Changes on every server response; used to remount the form with the returned values. */
  nonce: number;
}

export interface AuthorizeFormState {
  errors: FieldErrorMap;
  formError?: string;
  values?: { signerName: string; signerTitle: string; attest: boolean; authorize: boolean };
  nonce: number;
}

/** Stable DOM id for a dotted field name ("governors.0.name" -> "f-governors-0-name"). */
export function fieldId(name: string): string {
  return `f-${name.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}
