import { Question, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import type { JurisdictionDef } from "@/lib/compliance/types";

/**
 * The status object for a state we haven't verified. The fields a supported state
 * shows are drawn empty on purpose: we show no due dates or fees until we have
 * checked them against official sources.
 */
export function UnverifiedStatePanel({ j, className }: { j: JurisdictionDef; className?: string }) {
  return (
    <div className={cn("w-full rounded-[var(--radius-surface)] bg-surface p-5 shadow-lift sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-muted">
            {j.code}
          </span>
          <p className="font-display text-[17px] font-semibold leading-tight text-fg">{j.name}</p>
        </div>
        <Badge>Not yet verified</Badge>
      </div>

      <dl className="mt-5 grid gap-2.5">
        {["Due dates", "State fee", "Late fee"].map((term) => (
          <div
            key={term}
            className="flex min-h-12 items-center justify-between gap-4 rounded-[var(--radius-control)] border border-dashed border-border-strong bg-bg px-3.5 py-2.5"
          >
            <dt className="text-[14px] font-medium text-muted">{term}</dt>
            <dd className="flex items-center gap-1.5 text-right text-[13px] text-subtle">
              <Question size={14} weight="bold" aria-hidden className="shrink-0" />
              Not shown until verified
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-5 text-muted">
        <ShieldCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>We add a state only after checking its requirements against official government sources.</span>
      </p>
    </div>
  );
}
