import { cn } from "@/components/ui/cn";
import type { TimelineEntry } from "@/app/(app)/dashboard/_lib/data";
import { actorLabel, formatTimestamp, timelineLabel } from "./format";

/**
 * Customer-visible status history, oldest first. The newest entry is emphasized.
 * Timestamps are shown in Eastern time.
 */
export function StatusTimeline({ entries, startedAt }: { entries: TimelineEntry[]; startedAt: string }) {
  const items = [
    { id: "started", label: "Filing started", note: null as string | null, actor: "You", at: startedAt },
    ...entries.map((e) => ({
      id: e.id,
      label: timelineLabel(e.toStatus, e.fromStatus),
      note: e.note,
      actor: actorLabel(e.actorType),
      at: e.createdAt,
    })),
  ];
  const lastIndex = items.length - 1;

  return (
    <ol className="grid">
      {items.map((item, i) => {
        const isLast = i === lastIndex;
        return (
          <li key={item.id} className="relative grid grid-cols-[1.25rem_1fr] gap-x-3 pb-6 last:pb-0">
            {!isLast ? <span aria-hidden className="absolute left-[9px] top-5 bottom-0 w-px bg-border" /> : null}
            <span
              aria-hidden
              className={cn(
                "relative mt-1 size-[18px] rounded-full border-2",
                isLast ? "border-accent bg-accent-soft" : "border-border-strong bg-surface",
              )}
            >
              {isLast ? <span className="absolute inset-1 rounded-full bg-accent" /> : null}
            </span>
            <div className="grid gap-0.5">
              <p className={cn("text-[15px]", isLast ? "font-medium text-fg" : "text-fg")}>
                {item.label}
                {isLast ? <span className="sr-only"> (current)</span> : null}
              </p>
              <p className="text-sm text-subtle">
                <time dateTime={item.at} className="tnum">
                  {formatTimestamp(item.at)}
                </time>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                {item.actor}
              </p>
              {item.note ? <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
