import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { packetSections, type PacketRow } from "@/lib/filings/packet";

/**
 * The filing packet in the state portal's order: what Filewell will enter for the
 * customer. Used on the customer's Review and sign step and on the operator screens.
 */
export function FilingPacketView({
  rows,
  editHref,
  rowNote,
  dense,
}: {
  rows: PacketRow[];
  /** Link to edit the answer behind a row (customer view). */
  editHref?: (answerKey: string) => string | null;
  /** Extra per-row marker (operator view: provenance badges). */
  rowNote?: (row: PacketRow) => ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="grid gap-6">
      {packetSections(rows).map((group, gi) => (
        <section key={`${group.section}-${gi}`} aria-labelledby={`packet-s-${gi}`} className="grid gap-2">
          <h3 id={`packet-s-${gi}`} className="flex items-baseline gap-2 text-[15px] font-semibold text-fg">
            <span className="tnum text-[13px] font-medium text-subtle">{gi + 1}.</span>
            {group.section}
          </h3>
          <dl className="grid divide-y divide-border/70 rounded-[var(--radius-control)] border border-border bg-surface">
            {group.rows.map((r) => {
              const href = r.answerKey && editHref ? editHref(r.answerKey) : null;
              return (
                <div
                  key={`${r.stateField}-${r.answerKey ?? "fixed"}`}
                  className={cn("grid gap-1 px-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:gap-4", dense ? "py-2" : "py-3")}
                >
                  <dt className="text-sm text-muted">{r.stateField}</dt>
                  <dd className={cn("min-w-0 text-[15px] [overflow-wrap:anywhere]", r.notApplicable || !r.answerKey ? "text-muted" : "text-fg")}>
                    {r.value}
                    {rowNote ? <div className="mt-1">{rowNote(r)}</div> : null}
                  </dd>
                  {href ? (
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg sm:min-h-0"
                    >
                      <PencilSimple size={14} aria-hidden />
                      Edit<span className="sr-only"> {r.stateField}</span>
                    </Link>
                  ) : (
                    <span aria-hidden className="max-sm:hidden" />
                  )}
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
