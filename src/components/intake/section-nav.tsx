import { CaretDown, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

export interface SectionNavItem {
  key: string;
  title: string;
  done: boolean;
}

/**
 * Intake progress. Mobile: "Step 2 of 5" with a segmented bar and a collapsible list.
 * Desktop: the full list of sections as a sidebar.
 */
export function SectionNav({ filingId, sections, currentKey }: { filingId: string; sections: SectionNavItem[]; currentKey: string }) {
  const index = Math.max(0, sections.findIndex((s) => s.key === currentKey));
  const doneCount = sections.filter((s) => s.done).length;

  const list = (
    <ol className="grid gap-1">
      {sections.map((s, i) => {
        const current = s.key === currentKey;
        return (
          <li key={s.key}>
            <Link
              href={`/file/${filingId}/details?step=${encodeURIComponent(s.key)}`}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px] transition-colors",
                current ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {s.done ? (
                <CheckCircle size={20} weight="fill" className="shrink-0 text-accent" aria-hidden />
              ) : (
                <Circle size={20} className={cn("shrink-0", current ? "text-fg" : "text-subtle")} aria-hidden />
              )}
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
          <p className="font-medium text-fg">
            Step {index + 1} of {sections.length}
          </p>
          <p className="tnum text-muted">{doneCount} complete</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {sections.map((s, i) => (
            <span
              key={s.key}
              className={cn("h-1.5 flex-1 rounded-full", i === index ? "bg-accent" : s.done ? "bg-accent/35" : "bg-border")}
            />
          ))}
        </div>
        <details className="group rounded-[var(--radius-control)] border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-fg">
            All sections
            <CaretDown size={16} className="text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-border p-1.5">{list}</div>
        </details>
      </div>
      <div className="hidden lg:block">
        <p className="mb-2 px-3 text-sm text-muted">
          <span className="tnum">{doneCount}</span> of <span className="tnum">{sections.length}</span> sections complete
        </p>
        {list}
      </div>
    </nav>
  );
}
