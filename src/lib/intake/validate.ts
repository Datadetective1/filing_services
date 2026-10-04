import { z } from "zod";
import type { IntakeField, IntakeSchema, IntakeSection } from "@/lib/compliance/types";

/**
 * Validation built from a rule's data-driven intake schema. The same schema drives
 * the customer form, this validation, and the operator's filing packet.
 */

export interface Person {
  name: string;
  title: string;
  /** Only for people fields with `withAddress`. */
  address?: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postal_code: string;
  county?: string;
  country?: string;
}

export type RegisteredOffice =
  | ({ mode: "address" } & Address & { county: string })
  | { mode: "crop"; crop_name: string; county: string };

export type IntakeAnswers = Record<string, unknown>;

export type FieldErrors = Record<string, string>;

const PO_BOX = /\b(p\.?\s*o\.?\s*box|post\s*office\s*box|p\.?\s*o\.?\s*b\.?)\b/i;
const US_REGIONS = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR GU VI AS MP".split(
    " ",
  ),
);

const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max, `Must be ${max} characters or fewer`));

const requiredText = (max: number, label = "This field") =>
  text(max).pipe(z.string().min(1, `${label} is required`));

function addressSchema(opts: { noPoBox?: boolean; lockedRegion?: string; requireCounty?: boolean }) {
  return z
    .object({
      line1: requiredText(200, "Street address"),
      line2: text(200).optional().default(""),
      city: requiredText(100, "City"),
      region: requiredText(2, "State").transform((s) => s.toUpperCase()),
      postal_code: requiredText(10, "ZIP code").pipe(z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code")),
      county: opts.requireCounty ? requiredText(100, "County") : text(100).optional().default(""),
      country: z.literal("US").optional().default("US"),
    })
    .superRefine((a, ctx) => {
      if (!US_REGIONS.has(a.region)) ctx.addIssue({ code: "custom", path: ["region"], message: "Enter a U.S. state code" });
      if (opts.lockedRegion && a.region !== opts.lockedRegion)
        ctx.addIssue({ code: "custom", path: ["region"], message: `Must be in ${opts.lockedRegion}` });
      // The street line itself must not be a P.O. box (a box in line 2 alongside a street is fine).
      if (opts.noPoBox && PO_BOX.test(a.line1))
        ctx.addIssue({
          code: "custom",
          path: ["line1"],
          message: "A P.O. box alone isn't accepted. Use a street address.",
        });
    });
}

function fieldSchema(field: IntakeField): z.ZodType {
  switch (field.type) {
    case "text": {
      let s: z.ZodType<string> = field.required ? requiredText(field.maxLength ?? 300, field.label) : text(field.maxLength ?? 300);
      if (field.pattern) {
        const re = new RegExp(field.pattern);
        s = s.refine((v) => v === "" || re.test(v), field.patternMessage ?? "Invalid format");
      }
      return field.required ? s : s.optional().default("");
    }
    case "email": {
      const s = text(254).refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address");
      return field.required ? s.refine((v) => v !== "", `${field.label} is required`) : s.optional().default("");
    }
    case "choice": {
      const values = field.options.map((o) => o.value);
      let s: z.ZodType<string> = z.string().refine((v) => v === "" || values.includes(v), "Choose an option");
      for (const b of field.blocked ?? []) if (!b.when?.length) s = s.refine((v) => v !== b.value, b.message);
      return field.required ? s.refine((v) => v !== "", `${field.label} is required`) : s.optional().default("");
    }
    case "address":
      return addressSchema(field);
    case "registered_office": {
      const address = z
        .object({ mode: z.literal("address") })
        .and(addressSchema({ noPoBox: true, lockedRegion: field.region, requireCounty: true }));
      const crop = z.object({
        mode: z.literal("crop"),
        crop_name: requiredText(200, "Provider name"),
        county: requiredText(100, "County"),
      });
      // Pick the branch by `mode` so errors come only from the branch the customer chose.
      const pick = (v: unknown) => ((v as { mode?: string } | null)?.mode === "crop" ? crop : address);
      return z
        .unknown()
        .superRefine((v, ctx) => {
          const r = pick(v).safeParse(v);
          if (!r.success) {
            for (const issue of r.error.issues) ctx.addIssue({ code: "custom", message: issue.message, path: issue.path });
          }
        })
        .transform((v) => {
          const r = pick(v).safeParse(v);
          return r.success ? r.data : v;
        });
    }
    case "people": {
      const person = field.withAddress
        ? z.object({ name: requiredText(200, "Name"), title: requiredText(100, "Title"), address: requiredText(300, "Address") })
        : z.object({ name: requiredText(200, "Name"), title: requiredText(100, "Title") });
      return z
        .array(person)
        .max(field.max, `No more than ${field.max}`)
        .refine((arr) => arr.length >= field.min, field.min === 1 ? "Add at least one person" : `Add at least ${field.min}`);
    }
  }
}

/** Remove fully-empty people rows before validating (unused repeater rows). */
function normalize(field: IntakeField, value: unknown): unknown {
  if (field.type === "people" && Array.isArray(value)) {
    return value.filter(
      (p) => p && typeof p === "object" && (String(p.name ?? "").trim() || String(p.title ?? "").trim() || String(p.address ?? "").trim()),
    );
  }
  if (field.type === "people" && value === undefined) return [];
  return value;
}

/** True when the field applies: it has no `requiredWhen`, or every condition holds. */
export function conditionMet(field: IntakeField, raw: IntakeAnswers): boolean {
  if (!field.requiredWhen?.length) return true;
  return field.requiredWhen.every((c) => c.in.includes(String(raw[c.key] ?? "")));
}

export function validateSection(section: IntakeSection, raw: IntakeAnswers): { ok: boolean; values: IntakeAnswers; errors: FieldErrors } {
  const values: IntakeAnswers = {};
  const errors: FieldErrors = {};
  for (const field of section.fields) {
    if (!conditionMet(field, raw)) {
      // Not asked in this case: drop any earlier answer so it is never filed.
      values[field.key] = field.type === "people" ? [] : "";
      continue;
    }
    const parsed = fieldSchema(field).safeParse(normalize(field, raw[field.key]));
    const conditionalBlock =
      parsed.success && field.type === "choice"
        ? (field.blocked ?? []).find((b) => b.when?.length && b.value === parsed.data && b.when.every((c) => c.in.includes(String(raw[c.key] ?? ""))))
        : undefined;
    if (conditionalBlock) errors[field.key] = conditionalBlock.message;
    else if (parsed.success) values[field.key] = parsed.data;
    else {
      for (const issue of parsed.error.issues) {
        const path = [field.key, ...issue.path.map(String)].join(".");
        if (!errors[path]) errors[path] = issue.message;
      }
      if (!Object.keys(errors).some((k) => k === field.key || k.startsWith(`${field.key}.`))) {
        errors[field.key] = "Invalid value";
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}

export function validateAll(schema: IntakeSchema, answers: IntakeAnswers) {
  const values: IntakeAnswers = {};
  const errors: FieldErrors = {};
  const incompleteSections: string[] = [];
  for (const section of schema.sections) {
    const r = validateSection(section, answers);
    Object.assign(values, r.values);
    Object.assign(errors, r.errors);
    if (!r.ok) incompleteSections.push(section.key);
  }
  return { ok: incompleteSections.length === 0, values, errors, incompleteSections };
}

export function formatAddress(a: Partial<Address> | undefined | null): string {
  if (!a) return "Not provided";
  const line = [a.line1, a.line2].filter(Boolean).join(", ");
  const cityLine = [a.city, [a.region, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line, cityLine].filter(Boolean).join(", ") || "Not provided";
}

export function formatRegisteredOffice(r: RegisteredOffice | undefined | null): string {
  if (!r) return "Not provided";
  if (r.mode === "crop") return `${r.crop_name} (commercial registered office provider), ${r.county} County`;
  return `${formatAddress(r)}, ${r.county} County`;
}
