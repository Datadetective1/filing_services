import { Check } from "@phosphor-icons/react/dist/ssr";
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
        const note = item.note && item.note.trim().toLowerCase() !== item.label.toLowerCase() ? item.note : null;
        return (
          <li key={item.id} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
            {!isLast ? <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-0.5 rounded-full bg-accent/20" /> : null}
            <span
              aria-hidden
              className={cn(
                "relative mt-0.5 grid size-6 place-items-center rounded-full",
                isLast ? "bg-accent text-accent-fg ring-4 ring-accent/15" : "bg-accent-soft text-accent",
              )}
            >
              {isLast ? <span className="size-2 rounded-full bg-accent-fg" /> : <Check size={12} weight="bold" />}
            </span>
            <div className="grid min-w-0 gap-0.5">
              <p className={cn("text-[15px] leading-snug text-fg", isLast && "font-semibold")}>
                {item.label}
                {isLast ? <span className="sr-only"> (current)</span> : null}
              </p>
              <p className="text-[13px] text-subtle">
                <time dateTime={item.at} className="tnum">
                  {formatTimestamp(item.at)}
                </time>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                {item.actor}
              </p>
              {note ? <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">{note}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
