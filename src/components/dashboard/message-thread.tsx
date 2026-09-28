import { cn } from "@/components/ui/cn";
import type { MessageView } from "@/app/(app)/dashboard/_lib/data";
import { formatTimestamp, TEAM_NAME } from "./format";

/** Conversation between the customer and our team for one filing, oldest first. */
export function MessageThread({ messages }: { messages: MessageView[] }) {
  if (messages.length === 0) {
    return (
      <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
        No messages yet. If we need anything from you, our message will show up here.
      </p>
    );
  }
  return (
    <ol className="grid gap-3" aria-label="Messages">
      {messages.map((m) => {
        const mine = m.authorType === "customer";
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <article
              className={cn(
                "grid max-w-[min(36rem,100%)] gap-1.5 rounded-[var(--radius-surface)] border px-4 py-3",
                mine ? "border-accent/20 bg-accent-soft" : "border-border bg-surface-2",
              )}
            >
              <header className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium text-fg">{mine ? "You" : TEAM_NAME}</span>
                <time dateTime={m.createdAt} className="tnum text-xs text-subtle">
                  {formatTimestamp(m.createdAt)}
                </time>
              </header>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg">{m.body}</p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
