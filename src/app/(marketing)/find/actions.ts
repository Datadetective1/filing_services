"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getJurisdiction } from "@/lib/compliance/registry";
import { isISODate, todayInTimeZone } from "@/lib/domain/dates";
import { isEntityType } from "@/lib/domain/types";
import { lookupSchema, setPendingLookup } from "@/lib/lookup/pending";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIpHash } from "@/lib/security/request";
import type { LookupFormState, LookupValues } from "@/components/funnel/types";
import { setLookupHomeJurisdiction } from "./lookup-extras";

const FRIENDLY: Record<string, string> = {
  legalName: "Enter your business's legal name, up to 300 characters.",
  stateCode: "Choose a state.",
  entityType: "Choose an entity type.",
  formationDate: "Enter a valid date.",
  entityNumber: "Use letters, numbers and dashes only, up to 30 characters.",
};

const homeJurisdictionSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().max(100, "Use 100 characters or fewer."));

function readValues(formData: FormData): LookupValues {
  const str = (key: string) => {
    const v = formData.get(key);
    return typeof v === "string" ? v.slice(0, 400) : "";
  };
  const bool = (key: string) => formData.get(key) === "on";
  return {
    legalName: str("legalName").replace(/\s+/g, " ").trim(),
    stateCode: str("stateCode").trim().toUpperCase(),
    entityType: str("entityType").trim(),
    formationDate: str("formationDate").trim(),
    entityNumber: str("entityNumber").trim(),
    isForeign: bool("isForeign"),
    homeJurisdiction: str("homeJurisdiction"),
    isNonprofit: bool("isNonprofit"),
    alreadyFiledThisYear: bool("alreadyFiledThisYear"),
  };
}

/** Validate the visitor's lookup, keep it in a signed cookie across signup, show the result. */
export async function submitLookup(_prev: LookupFormState, formData: FormData): Promise<LookupFormState> {
  const values = readValues(formData);
  const errors: Record<string, string> = {};
  const nonce = Date.now();

  const jurisdiction = getJurisdiction(values.stateCode);
  if (!/^[A-Z]{2}$/.test(values.stateCode) || !jurisdiction) errors.stateCode = FRIENDLY.stateCode;
  if (!isEntityType(values.entityType)) errors.entityType = FRIENDLY.entityType;

  if (values.formationDate) {
    const today = todayInTimeZone(jurisdiction?.timezone ?? "America/New_York");
    if (!isISODate(values.formationDate) || values.formationDate < "1800-01-01") errors.formationDate = FRIENDLY.formationDate;
    else if (values.formationDate > today) errors.formationDate = "The formation date can't be in the future.";
  }

  let homeJurisdiction: string | null = null;
  if (values.isForeign) {
    const home = homeJurisdictionSchema.safeParse(values.homeJurisdiction);
    if (home.success) homeJurisdiction = home.data || null;
    else errors.homeJurisdiction = home.error.issues[0]?.message ?? "Check this field.";
  }

  const parsed = lookupSchema.safeParse({
    stateCode: values.stateCode,
    entityType: values.entityType,
    legalName: values.legalName,
    formationDate: values.formationDate || null,
    entityNumber: values.entityNumber,
    isForeign: values.isForeign,
    isNonprofit: values.isNonprofit,
    alreadyFiledThisYear: values.alreadyFiledThisYear,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      errors[key] ??= FRIENDLY[key] ?? issue.message;
    }
  }

  if (Object.keys(errors).length > 0 || !parsed.success) {
    return { errors, values, nonce };
  }

  const ip = (await clientIpHash()) ?? "unknown";
  if (!(await rateLimit(`lookup:${ip}`, 20, 60))) {
    return { errors: {}, formError: "Too many lookups in a short time. Please wait a minute and try again.", values, nonce };
  }

  await setPendingLookup(parsed.data);
  await setLookupHomeJurisdiction(homeJurisdiction);
  redirect("/find/result");
}
