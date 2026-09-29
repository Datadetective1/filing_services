import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

export interface SectionNavItem {
  key: string;
  title: string;
  done: boolean;
}

/**
 * Intake progress. Mobile: "Step 2 of 5" with a segmented bar and a collapsible list.
 * Desktop: the full list of sections as a sidebar, joined by a track.
 */
export function SectionNav({ filingId, sections, currentKey }: { filingId: string; sections: SectionNavItem[]; currentKey: string }) {
  const index = Math.max(0, sections.findIndex((s) => s.key === currentKey));
  const doneCount = sections.filter((s) => s.done).length;

  const list = (
    <ol className="grid">
      {sections.map((s, i) => {
        const current = s.key === currentKey;
        const last = i === sections.length - 1;
        return (
          <li key={s.key} className="relative">
            {!last ? (
              <span
                aria-hidden
                className={cn("absolute left-[23px] top-[34px] h-[calc(100%-22px)] w-0.5 rounded-full", s.done ? "bg-accent/40" : "bg-border")}
              />
            ) : null}
            <Link
              href={`/file/${filingId}/details?step=${encodeURIComponent(s.key)}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "relative flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px] transition-colors",
                current ? "bg-surface font-semibold text-fg shadow-[0_1px_2px_rgb(23_35_29/0.06)] ring-1 ring-border" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "tnum grid size-[22px] shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold",
                  s.done
                    ? "border-accent bg-accent text-accent-fg"
                    : current
                      ? "border-accent bg-surface text-accent"
                      : "border-border-strong bg-bg text-subtle",
                )}
              >
                {s.done ? <Check size={12} weight="bold" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </span>
              {s.done ? <span className="sr-only">(complete)</span> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="Filing sections">
      <div className="grid gap-3 lg:hidden">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-semibold text-fg">
            Step <span className="tnum">{index + 1}</span> of <span className="tnum">{sections.length}</span>
            <span className="font-normal text-muted"> · {sections[index]?.title}</span>
          </p>
          <p className="tnum shrink-0 text-muted">{doneCount} done</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {sections.map((s, i) => (
            <span
              key={s.key}
              className={cn("h-1.5 flex-1 rounded-full", i === index ? "bg-accent" : s.done ? "bg-accent/40" : "bg-surface-3")}
            />
          ))}
        </div>
        <details className="group rounded-[var(--radius-control)] border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
            All sections
            <CaretDown size={16} weight="bold" className="text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border p-1.5">{list}</div>
        </details>
      </div>
      <div className="hidden lg:block">
        <p className="mb-2 px-3 text-[13px] font-semibold uppercase tracking-wider text-subtle">
          <span className="tnum">{doneCount}</span> of <span className="tnum">{sections.length}</span> done
        </p>
        {list}
      </div>
    </nav>
  );
}
