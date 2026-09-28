import { PencilSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { IntakeField, IntakeSection } from "@/lib/compliance/types";
import { formatAddress, formatRegisteredOffice, type Address, type RegisteredOffice } from "@/lib/intake/validate";
import { cn } from "@/components/ui/cn";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function FieldValue({ field, value }: { field: IntakeField; value: unknown }) {
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
            </li>
          ))}
        </ul>
      );
    }
  }
}

/** Read-only summary of one intake section with an Edit link, used on the review page. */
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
      className={cn(
        "rounded-[var(--radius-surface)] border bg-surface",
        incomplete ? "border-warning/40" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <h2 id={`review-${section.key}`} className="flex items-center gap-2 text-base font-semibold tracking-tight text-fg">
          {incomplete ? <WarningCircle size={18} weight="fill" className="text-warning" aria-hidden /> : null}
          {section.title}
          {incomplete ? <span className="sr-only">(needs attention)</span> : null}
        </h2>
        <Link
          href={editHref}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
        >
          <PencilSimple size={16} aria-hidden />
          Edit<span className="sr-only"> {section.title}</span>
        </Link>
      </div>
      <dl className="grid gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(9rem,13rem)_1fr] sm:px-5">
        {section.fields.map((field) => (
          <div key={field.key} className="contents">
            <dt className="text-sm text-muted">{field.label}</dt>
            <dd className="text-[15px] text-fg [overflow-wrap:anywhere]">
              <FieldValue field={field} value={answers[field.key]} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
