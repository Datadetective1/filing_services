"use server";

import { z } from "zod";
import { getJurisdiction } from "@/lib/compliance/registry";
import { todayInTimeZone } from "@/lib/domain/dates";
import { ENTITY_TYPES } from "@/lib/domain/types";
import { cleanSignupPage, formationFromMonth, reminderSignupOptions } from "@/lib/reminders/signup-options";
import { subscribeToReminders } from "@/lib/reminders/subscribers";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";

export type DeadlineReminderFields = "email" | "businessName" | "entityType" | "formed" | "consent";

export type DeadlineReminderState =
  | { ok: true; email: string }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Partial<Record<DeadlineReminderFields, string>>;
      /** What was typed, handed back because React resets the form after the action. */
      values?: Partial<Record<"email" | "businessName" | "entityType" | "month" | "year", string>>;
    }
  | undefined;

const schema = z.object({
  stateCode: z.string().regex(/^[A-Z]{2}$/),
  entityType: z.enum(ENTITY_TYPES, { error: "Pick your business type" }),
  businessName: z.string().trim().min(1, "Enter your business name").max(300, "Use 300 characters or fewer"),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")).pipe(z.string().max(254)),
  consent: z.literal("yes", { error: "Tick the box to confirm you want these reminders" }),
  fw_hp: z.string().max(0).optional(),
});

const str = (f: FormData, k: string) => String(f.get(k) ?? "").slice(0, 300);

/**
 * "Remind me before my deadline" from a state's annual report or guide page: no lookup,
 * no account, nothing bought. The visitor types the business name (and the month it
 * formed where the due date depends on it); we compute the due date from the verified
 * rule, email a confirmation link from the Filewell address, and send reminders only
 * after they confirm.
 */
export async function signUpForDeadlineReminder(_: DeadlineReminderState, formData: FormData): Promise<DeadlineReminderState> {
  const values = {
    email: str(formData, "email"),
    businessName: str(formData, "businessName"),
    entityType: str(formData, "entityType"),
    month: str(formData, "month"),
    year: str(formData, "year"),
  };
  const parsed = schema.safeParse({
    stateCode: str(formData, "stateCode"),
    entityType: values.entityType,
    businessName: values.businessName,
    email: values.email,
    consent: formData.get("consent") ?? undefined,
    fw_hp: (formData.get("fw_hp") as string | null) ?? undefined,
  });

  const fieldErrors: Partial<Record<DeadlineReminderFields, string>> = {};
  if (!parsed.success) {
    // A filled honeypot is a bot: pretend it worked and do nothing.
    if (parsed.error.issues.some((i) => i.path[0] === "fw_hp")) return { ok: true, email: "" };
    if (parsed.error.issues.some((i) => i.path[0] === "stateCode")) return { ok: false, error: "Something went wrong. Reload the page and try again.", values };
    for (const i of parsed.error.issues) {
      const k = i.path[0] as DeadlineReminderFields;
      if (k in { email: 1, businessName: 1, entityType: 1, consent: 1 }) fieldErrors[k] ??= i.message;
    }
  }

  const stateCode = str(formData, "stateCode");
  const options = reminderSignupOptions(stateCode);
  const entity = options?.entities.find((e) => e.value === values.entityType);
  if (!options) return { ok: false, error: "We can't set up reminders for this state yet.", values };
  if (!entity && !fieldErrors.entityType) fieldErrors.entityType = "Pick your business type";

  const today = todayInTimeZone(getJurisdiction(stateCode)?.timezone ?? "America/New_York");
  let formationDate: string | null = null;
  if (entity?.needsFormation) {
    formationDate = formationFromMonth(values.month, values.year, today);
    if (!formationDate) fieldErrors.formed = "Pick the month and year your business was formed";
  }

  if (!parsed.success || Object.keys(fieldErrors).length || !entity) return { ok: false, fieldErrors, values };

  const ip = (await clientIpHash().catch(() => null)) ?? "unknown";
  if (!(await rateLimit(`reminder-optin:${ip}`, 5, 600))) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again.", values };
  }

  const lookup = {
    stateCode: options.stateCode,
    entityType: entity.value,
    legalName: parsed.data.businessName,
    formationDate,
    entityNumber: null,
    isForeign: false,
    isNonprofit: entity.value === "nonprofit_corporation",
    alreadyFiledThisYear: false,
    registryEntityNumber: null,
  };
  const page = cleanSignupPage(formData.get("page"));
  const r = await subscribeToReminders(parsed.data.email, lookup, true, { page }).catch(() => ({ status: "error" as const }));
  switch (r.status) {
    case "sent":
    case "throttled":
    case "already_confirmed":
      return { ok: true, email: parsed.data.email };
    case "unsupported":
      return { ok: false, error: "We can't set up reminders for this business type yet.", values };
    default:
      return { ok: false, error: "We couldn't save that right now. Please try again later.", values };
  }
}
