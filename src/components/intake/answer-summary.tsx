import { PencilSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { IntakeField, IntakeSection } from "@/lib/compliance/types";
import { formatAddress, formatRegisteredOffice, type Address, type RegisteredOffice } from "@/lib/intake/validate";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function FieldValue({ field, value }: { field: IntakeField; value: unknown }) {
  const empty = <span className="text-subtle">Not provided</span>;
  switch (field.type) {
    case "text":
    case "email":
      return typeof value === "string" && value.trim() ? <>{value}</> : empty;
    case "choice": {
      const option = field.options.find((o) => o.value === value);
      return option ? <>{option.label}</> : <span className="text-subtle">Not answered</span>;
    }
    case "address": {
      const a = asRecord(value) as Partial<Address> | null;
      if (!a || !a.line1) return empty;
      return (
        <>
          {formatAddress(a)}
          {a.county ? `, ${a.county} County` : ""}
        </>
      );
    }
    case "registered_office": {
      const r = asRecord(value) as RegisteredOffice | null;
      if (!r || (r.mode !== "crop" && r.mode !== "address")) return empty;
      if (r.mode === "crop" && !r.crop_name) return empty;
      if (r.mode === "address" && !r.line1) return empty;
      return <>{formatRegisteredOffice(r)}</>;
    }
    case "people": {
      const people = (Array.isArray(value) ? value : [])
        .map(asRecord)
        .filter((p): p is Record<string, unknown> => Boolean(p && (p.name || p.title)));
      if (people.length === 0) return <span className="text-subtle">None listed</span>;
      return (
        <ul className="grid gap-1">
          {people.map((p, i) => (
            <li key={i}>
              {String(p.name ?? "")}
              {p.title ? <span className="text-muted">, {String(p.title)}</span> : null}
              {p.address ? <span className="block text-sm text-muted">{String(p.address)}</span> : null}
            </li>
          ))}
        </ul>
      );
    }
  }
}

/**
 * Read-only summary of one intake section with an Edit link, used on the review page.
 * Rendered as one part of the summary document (the page supplies the sheet).
 */
export function AnswerSummary({
  section,
  answers,
  editHref,
  incomplete,
}: {
  section: IntakeSection;
  answers: Record<string, unknown>;
  editHref: string;
  incomplete?: boolean;
}) {
  return (
    <section
      aria-labelledby={`review-${section.key}`}
      className="py-6 sm:py-7"
    >
      <div className="flex items-center justify-between gap-4">
        <h3
          id={`review-${section.key}`}
          className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-muted"
        >
          {incomplete ? <WarningCircle size={18} weight="fill" className="text-warning" aria-hidden /> : null}
          {section.title}
          {incomplete ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-warning">Needs attention</span> : null}
        </h3>
        <Link
          href={editHref}
          className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent"
        >
          <PencilSimple size={16} weight="bold" aria-hidden />
          Edit<span className="sr-only"> {section.title}</span>
        </Link>
      </div>
      <dl className="mt-4 grid gap-x-8 gap-y-3.5 sm:grid-cols-[minmax(9rem,12rem)_1fr]">
        {section.fields.map((field) => (
          <div key={field.key} className="contents">
            <dt className="text-sm text-muted">{field.label}</dt>
            <dd className="-mt-2.5 text-[15px] font-medium text-fg [overflow-wrap:anywhere] sm:mt-0">
              <FieldValue field={field} value={answers[field.key]} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
