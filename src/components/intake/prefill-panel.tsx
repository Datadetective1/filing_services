import { CheckCircle, CircleDashed } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { IntakeField, IntakeSection } from "@/lib/compliance/types";
import { buttonClasses } from "@/components/ui/button";
import { FieldValue } from "./answer-summary";

type Source = "state_registry" | "previous_filing" | "business_profile";

const SOURCE_TEXT: Record<Source, string> = {
  state_registry: "Pennsylvania's business register",
  previous_filing: "your last filing with us",
  business_profile: "your saved business details",
};

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

/**
 * Shown before the step-by-step form when we prefilled the filing: every prefilled value,
 * where it came from, what is still missing, and one question: has anything changed?
 */
export function PrefillPanel({
  sections,
  answers,
  prefill,
  missing,
  acceptAction,
  editHref,
}: {
  sections: IntakeSection[];
  answers: Record<string, unknown>;
  prefill: { field_key: string; source: Source; retrieved_at: string }[];
  missing: { key: string; label: string }[];
  acceptAction: () => Promise<void>;
  editHref: string;
}) {
  const bySource = new Map(prefill.map((p) => [p.field_key, p]));
  const fields: IntakeField[] = sections.flatMap((s) => s.fields).filter((f) => bySource.has(f.key));
  const fromRegistry = prefill.find((p) => p.source === "state_registry");
  const sources = [...new Set(prefill.map((p) => p.source))];

  return (
    <section aria-labelledby="prefill-title" className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-9">
      <div className="grid gap-2 border-b border-border pb-6">
        <h2 id="prefill-title" className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[28px]">
          {fromRegistry ? "Pennsylvania record found" : "We filled in what we already know"}
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
          From {sources.map((s) => SOURCE_TEXT[s]).join(" and ")}
          {fromRegistry ? ` (retrieved ${formatDay(fromRegistry.retrieved_at)}; the register is updated monthly)` : ""}. Check each
          value: this is what we will file, and you confirm it&apos;s current before you sign.
        </p>
      </div>

      <dl className="mt-6 grid gap-4">
        {fields.map((f) => (
          <div key={f.key} className="grid gap-1 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
            <dt className="flex items-start gap-2 text-sm font-semibold text-fg">
              <CheckCircle size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
              {f.label}
            </dt>
            <dd className="text-[15px] leading-6 text-fg">
              <FieldValue field={f} value={answers[f.key]} />
              <span className="block text-xs text-subtle">From {SOURCE_TEXT[bySource.get(f.key)!.source]}</span>
            </dd>
          </div>
        ))}
        {missing.map((m) => (
          <div key={m.key} className="grid gap-1 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
            <dt className="flex items-start gap-2 text-sm font-semibold text-fg">
              <CircleDashed size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
              {m.label}
            </dt>
            <dd className="text-[15px] text-muted">We still need this from you.</dd>
          </div>
        ))}
      </dl>

      {fromRegistry ? (
        <p className="mt-6 max-w-[62ch] text-sm leading-6 text-muted">
          The register shows one street address, which is usually the registered office. If you use a commercial registered
          office provider (CROP), choose that option and enter its name instead.
        </p>
      ) : null}

      <div className="mt-7 grid gap-3 border-t border-border pt-6">
        <p className="text-[17px] font-semibold text-fg">Has anything changed?</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={acceptAction}>
            <button type="submit" className={buttonClasses("primary", "md", "w-full sm:w-auto")}>
              {missing.length ? "No, it's all current. Add what's missing" : "No, it's all current. Go to review"}
            </button>
          </form>
          <Link href={editHref} className={buttonClasses("secondary", "md", "w-full sm:w-auto")}>
            Yes, let me update it
          </Link>
        </div>
        <p className="text-sm text-subtle">Either way, you review every value and sign before anything is filed.</p>
      </div>
    </section>
  );
}
