import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import type { JurisdictionDef } from "@/lib/compliance/types";
import type { StateAnswer } from "@/lib/seo/state-answers";

/**
 * The status object for a state with a checked answer but no full guide yet: the due date and
 * the state's charges, each read on an official page. No link to the state's own site.
 */
export function StateAnswerPanel({ j, answer, className }: { j: JurisdictionDef; answer: StateAnswer; className?: string }) {
  return (
    <div className={cn("w-full rounded-[var(--radius-surface)] bg-surface p-5 shadow-lift sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-muted">
            {j.code}
          </span>
          <p className="font-display text-[17px] font-semibold leading-tight text-fg">{j.name}</p>
        </div>
        <Badge tone="success">Checked</Badge>
      </div>
      <dl className="mt-5 grid gap-2.5">
        {answer.facts.map((f) => (
          <div key={f.term} className="grid gap-0.5 rounded-[var(--radius-control)] border border-border bg-bg px-3.5 py-2.5">
            <dt className="text-[13px] font-medium text-muted">{f.term}</dt>
            <dd className="text-[15px] font-semibold leading-snug text-fg">{f.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-5 text-muted">
        <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>Read on official {j.name} sources. State charges are set by the state.</span>
      </p>
    </div>
  );
}
