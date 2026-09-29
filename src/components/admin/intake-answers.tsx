import type { IntakeField, IntakeSchema } from "@/lib/compliance/types";
import { formatAddress, formatRegisteredOffice, type Address, type Person, type RegisteredOffice } from "@/lib/intake/validate";

/**
 * Renders a filing's answers using the intake schema frozen in its rule snapshot,
 * so the operator sees exactly the sections and labels the customer filled in.
 */

export function answerText(field: IntakeField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "Not provided";
  switch (field.type) {
    case "text":
    case "email":
      return String(value);
    case "choice": {
      const option = field.options.find((o) => o.value === value);
      return option?.label ?? String(value);
    }
    case "address": {
      const a = value as Address;
      const base = formatAddress(a);
      return a.county ? `${base} (${a.county} County)` : base;
    }
    case "registered_office":
      return formatRegisteredOffice(value as RegisteredOffice);
    case "people": {
      const people = Array.isArray(value) ? (value as Person[]) : [];
      if (!people.length) return "None listed";
      return people.map((p) => `${p.name}, ${p.title}`).join("; ");
    }
  }
}

export function PeopleList({ people }: { people: Person[] }) {
  if (!people.length) return <span className="text-muted">None listed</span>;
  return (
    <ul className="grid gap-0.5">
      {people.map((p, i) => (
        <li key={`${p.name}-${i}`}>
          <span className="font-medium">{p.name}</span>
          <span className="text-muted">, {p.title}</span>
        </li>
      ))}
    </ul>
  );
}

export function IntakeAnswersView({ schema, answers }: { schema: IntakeSchema | null | undefined; answers: Record<string, unknown> }) {
  if (!schema?.sections?.length) {
    return <p className="text-sm text-muted">This filing has no intake schema in its rule snapshot.</p>;
  }
  return (
    <div className="grid gap-6">
      {schema.sections.map((section) => (
        <div key={section.key} className="grid gap-2">
          <h3 className="text-[13px] font-semibold text-subtle">{section.title}</h3>
          <dl className="grid text-sm">
            {section.fields.map((field) => {
              const value = answers[field.key];
              const missing = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
              return (
                <div
                  key={field.key}
                  className="grid gap-0.5 border-t border-border/60 py-2.5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-muted">
                    {field.label}
                    {field.required ? null : <span className="text-subtle"> (optional)</span>}
                  </dt>
                  <dd className={missing && field.required ? "font-semibold text-danger" : "min-w-0 break-words text-fg"}>
                    {field.type === "people" && Array.isArray(value) ? (
                      <PeopleList people={value as Person[]} />
                    ) : missing && field.required ? (
                      "Missing"
                    ) : (
                      answerText(field, value)
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
