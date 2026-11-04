import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { formatCents } from "@/lib/domain/money";
import type { ProviderReportOffer } from "./provider-report-band";

/**
 * The status object for a state where we file the annual report through our provider: the
 * all-in price per entity type, split into the state fee and ours. Only fees checked on the
 * state's own site are shown.
 */
export function ProviderReportPanel({ offer, className }: { offer: ProviderReportOffer; className?: string }) {
  const { open, serviceCents, types } = offer;
  return (
    <div className={cn("w-full rounded-[var(--radius-surface)] bg-surface p-5 shadow-lift sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md border border-border-strong bg-surface-2 px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-muted">
            {open.code}
          </span>
          <p className="font-display text-[17px] font-semibold leading-tight text-fg">{open.name}</p>
        </div>
        <Badge tone="success">We file it</Badge>
      </div>

      <dl className="mt-5 grid gap-2.5">
        {types.map((t) => {
          const state = open.feeCents[t] ?? 0;
          return (
            <div key={t} className="grid gap-1 rounded-[var(--radius-control)] border border-border bg-bg px-3.5 py-3">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[14px] font-medium text-fg">{t === "llc" ? "LLC" : "Corporation"}</dt>
                <dd className="tnum font-display text-[20px] font-semibold text-fg">{formatCents(serviceCents + state, { trimZeros: true })}</dd>
              </div>
              <p className="tnum text-[13px] text-muted">
                {state > 0 ? `${formatCents(state, { trimZeros: true })} state fee + ` : "No state fee + "}
                {formatCents(serviceCents, { trimZeros: true })} ours
              </p>
            </div>
          );
        })}
      </dl>

      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-5 text-muted">
        <ShieldCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>State fee checked on the state&apos;s official site. Paid once, nothing renews.</span>
      </p>
    </div>
  );
}
