import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export interface TocItem {
  id: string;
  label: string;
}

/** Sticky "On this page" list for wide screens, with an optional call to action under it. */
export function OnThisPageAside({ items, children, className }: { items: TocItem[]; children?: ReactNode; className?: string }) {
  return (
    <aside className={cn("max-lg:hidden", className)}>
      <nav aria-label="On this page" className="sticky top-[92px] grid gap-0.5 text-[14px]">
        <p className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-wider text-subtle">On this page</p>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-[var(--radius-control)] px-3 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {item.label}
          </a>
        ))}
        {children ? <div className="mt-5 grid gap-3 border-t border-border px-3 pt-5">{children}</div> : null}
      </nav>
    </aside>
  );
}

/** Collapsed "On this page" list for phones and tablets. */
export function OnThisPageDisclosure({ items, className }: { items: TocItem[]; className?: string }) {
  return (
    <details className={cn("group rounded-[var(--radius-surface)] border border-border bg-surface lg:hidden", className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold text-fg [&::-webkit-details-marker]:hidden">
        On this page
        <CaretDown size={16} weight="bold" aria-hidden className="text-muted transition-transform group-open:rotate-180" />
      </summary>
      <nav aria-label="On this page" className="grid border-t border-border px-2 py-2">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="flex min-h-11 items-center rounded-[var(--radius-control)] px-2 text-[15px] text-muted hover:bg-surface-2 hover:text-fg">
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
