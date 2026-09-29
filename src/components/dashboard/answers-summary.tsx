import type { ReactNode } from "react";
import type { IntakeField, IntakeSchema } from "@/lib/compliance/types";
import { formatAddress, formatRegisteredOffice, type Address, type RegisteredOffice } from "@/lib/intake/validate";

const NOT_PROVIDED = <span className="font-normal text-subtle">Not provided</span>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function renderValue(field: IntakeField, value: unknown): ReactNode {
  switch (field.type) {
    case "text":
    case "email":
      return text(value) || NOT_PROVIDED;
    case "choice": {
      const v = text(value);
      if (!v) return NOT_PROVIDED;
      return field.options.find((o) => o.value === v)?.label ?? v;
    }
    case "address": {
      if (!isRecord(value) || !text(value.line1)) return NOT_PROVIDED;
      const a = value as unknown as Address;
      const county = text(a.county);
      return county ? `${formatAddress(a)} (${county} County)` : formatAddress(a);
    }
    case "registered_office": {
      if (!isRecord(value)) return NOT_PROVIDED;
      if (value.mode === "crop") {
        if (!text(value.crop_name)) return NOT_PROVIDED;
        return formatRegisteredOffice({ mode: "crop", crop_name: text(value.crop_name), county: text(value.county) });
      }
      if (!text(value.line1)) return NOT_PROVIDED;
      const r = { ...(value as unknown as Address), mode: "address", county: text(value.county) } as RegisteredOffice;
      return text(value.county) ? formatRegisteredOffice(r) : formatAddress(r as Address);
    }
    case "people": {
      const people = Array.isArray(value)
        ? value.filter(isRecord).filter((p) => text(p.name) || text(p.title))
        : [];
      if (people.length === 0) return field.required ? NOT_PROVIDED : <span className="font-normal text-subtle">None listed</span>;
      return (
        <ul className="grid gap-1">
          {people.map((p, i) => (
            <li key={i}>
              {text(p.name)}
              {text(p.title) ? <span className="font-normal text-muted">, {text(p.title)}</span> : null}
            </li>
          ))}
        </ul>
      );
    }
  }
}

/**
 * The customer's filing details, rendered with the intake schema frozen on the
 * filing (so labels match what they saw when they ordered).
 */
export function AnswersSummary({ schema, answers }: { schema: IntakeSchema; answers: Record<string, unknown> }) {
  return (
    <div className="grid divide-y divide-border">
      {schema.sections.map((section) => (
        <section
          key={section.key}
          aria-labelledby={`answers-${section.key}`}
          className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] md:gap-6"
        >
          <h3 id={`answers-${section.key}`} className="text-[15px] font-semibold text-fg">
            {section.title}
          </h3>
          <dl className="grid gap-3">
            {section.fields.map((field) => (
              <div key={field.key} className="grid gap-0.5">
                <dt className="text-[13px] font-medium text-muted">{field.label}</dt>
                <dd className="break-words text-[15px] font-medium text-fg">{renderValue(field, answers[field.key])}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
