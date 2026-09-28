import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { FaqItem } from "@/lib/compliance/types";
import { cn } from "@/components/ui/cn";

/** Accessible FAQ accordion built on native <details>, so it works without JavaScript. */
export function FaqList({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-border border-y border-border", className)}>
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-[15px] font-medium text-fg sm:text-base [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <Plus
              size={18}
              weight="bold"
              aria-hidden
              className="shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
            />
          </summary>
          <p className="max-w-[68ch] pb-5 pr-10 text-[15px] leading-7 text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
