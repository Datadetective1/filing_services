import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { ENTITY_TYPES } from "@/lib/domain/types";
import { createSignedToken, verifySignedToken } from "@/lib/security/tokens";

/**
 * The business lookup a visitor entered BEFORE signing up, carried across signup in
 * a signed, HttpOnly cookie (never in the URL). It is data the visitor typed —
 * never presented as a state record.
 */

const COOKIE = "fw_lookup";

export const lookupSchema = z.object({
  stateCode: z.string().regex(/^[A-Z]{2}$/),
  entityType: z.enum(ENTITY_TYPES),
  legalName: z.string().trim().min(1, "Enter your business's legal name").max(300),
  formationDate: z
    .preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional())
    .transform((v) => v || null),
  entityNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and dashes only")
    // Nullable: the stored (already-parsed) value is null when empty and is re-parsed on read.
    .nullable()
    .optional()
    .transform((v) => v || null),
  isForeign: z.boolean().default(false),
  isNonprofit: z.boolean().default(false),
  alreadyFiledThisYear: z.boolean().default(false),
  /** Set only by the server after it fetched this entity from the state's register itself. */
  registryEntityNumber: z
    .string()
    .regex(/^[0-9]{1,10}$/)
    .nullable()
    .optional()
    .transform((v) => v || null),
});

export type PendingLookup = z.infer<typeof lookupSchema>;

export async function setPendingLookup(value: PendingLookup): Promise<void> {
  const token = createSignedToken("lookup", { v: value }, 60 * 60 * 24);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readPendingLookup(): Promise<PendingLookup | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const payload = verifySignedToken<{ v: unknown }>("lookup", raw);
  if (!payload) return null;
  const parsed = lookupSchema.safeParse(payload.v);
  return parsed.success ? parsed.data : null;
}

export async function clearPendingLookup(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
