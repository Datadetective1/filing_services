import { ChatsCircle } from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/layout/logo";
import { cn } from "@/components/ui/cn";
import type { MessageView } from "@/app/(app)/dashboard/_lib/data";
import { formatTimestamp, TEAM_NAME } from "./format";

function YouAvatar() {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg"
    >
      You
    </span>
  );
}

/** Conversation between the customer and our team for one filing, oldest first. */
export function MessageThread({ messages }: { messages: MessageView[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex items-start gap-4 rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 p-5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <ChatsCircle size={22} weight="fill" />
        </span>
        <div className="grid gap-1">
          <p className="font-semibold text-fg">No messages yet</p>
          <p className="text-[15px] leading-6 text-muted">
            If we need anything from you, our message will show up here. Have a question? Write to us below. Someone on our
            team reads every message and writes back.
          </p>
        </div>
      </div>
    );
  }
  return (
    <ol className="grid gap-5" aria-label="Messages">
      {messages.map((m) => {
        const mine = m.authorType === "customer";
        return (
          <li key={m.id} className={cn("flex items-end gap-2.5", mine ? "flex-row-reverse" : "flex-row")}>
            {mine ? <YouAvatar /> : <LogoMark />}
            <article className={cn("grid min-w-0 max-w-[min(36rem,calc(100%-3rem))] gap-1.5", mine ? "justify-items-end" : "justify-items-start")}>
              <header className={cn("flex flex-wrap items-baseline gap-x-2 px-1 text-sm", mine && "flex-row-reverse")}>
                <span className="font-semibold text-fg">{mine ? "You" : TEAM_NAME}</span>
                <time dateTime={m.createdAt} className="tnum text-[13px] text-subtle">
                  {formatTimestamp(m.createdAt)}
                </time>
              </header>
              <p
                className={cn(
                  "whitespace-pre-wrap break-words px-4 py-3 text-[15px] leading-relaxed text-fg",
                  mine
                    ? "rounded-[18px] rounded-br-[6px] bg-accent-soft"
                    : "rounded-[18px] rounded-bl-[6px] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.05)]",
                )}
              >
                {m.body}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
