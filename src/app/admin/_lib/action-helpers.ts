import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/components/admin/action-state";
import { DocumentValidationError } from "@/lib/documents/storage";
import { OperationError } from "@/lib/filings/operations";

/** Helpers shared by the console's server actions. Never used for authorization. */

export function fail(error: string): ActionState {
  return { ok: false, error: cleanCopy(error) };
}

export function ok(message: string, details?: { label: string; value: string }[]): ActionState {
  return { ok: true, message, details };
}

/** Visible copy never shows long dashes, even when a lower layer's message has one. */
function cleanCopy(text: string): string {
  return text.replace(/\s*[\u2013\u2014]\s*/g, "-");
}

/** Validate FormData with a zod object schema. Returns the first issue as the error. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Check the form and try again." };
  }
  return { ok: true, data: result.data };
}

/**
 * Turn a thrown error into operator-facing text. Next.js control-flow errors
 * (redirect, notFound) are rethrown untouched.
 */
export function actionError(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof OperationError || error instanceof DocumentValidationError) return fail(error.message);
  console.error("[admin action]", error);
  if (error instanceof Error) return fail(`The action failed: ${error.message}`);
  return fail("The action failed. Try again.");
}
