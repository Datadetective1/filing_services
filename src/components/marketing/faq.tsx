import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { FaqItem } from "@/lib/compliance/types";
import { cn } from "@/components/ui/cn";

/** Accessible FAQ accordion built on native <details>, so it works without JavaScript. */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-display text-[17px] font-semibold text-fg transition-colors hover:text-accent sm:text-lg [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-fg transition-[transform,background-color] duration-200 group-open:rotate-45 group-open:bg-highlight-soft"
            >
              <Plus size={16} weight="bold" />
            </span>
          </summary>
          <p className="max-w-[68ch] pb-6 pr-12 text-base leading-7 text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
