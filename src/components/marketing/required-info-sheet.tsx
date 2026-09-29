import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

/**
 * What a report asks for, drawn as the paper form itself: a titled sheet with a
 * folded corner and one checked line per item.
 */
export function RequiredInfoSheet({
  title,
  formNumber,
  items,
  className,
}: {
  title: string;
  formNumber?: string;
  items: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative max-w-3xl overflow-hidden rounded-[8px] border border-border bg-surface px-5 pb-4 pt-6 shadow-card sm:px-8 sm:pt-7",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute right-0 top-0 size-9 rounded-bl-[8px] bg-[linear-gradient(225deg,var(--bg)_50%,var(--surface-3)_50%)] shadow-[-1px_1px_2px_rgb(23_35_29/0.08)]"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-fg/80 pb-3 pr-8">
        <p className="font-display text-lg font-semibold text-fg">{title}</p>
        {formNumber ? <p className="font-mono text-[12px] uppercase tracking-wider text-subtle">{formNumber}</p> : null}
      </div>
      <ul className="grid">
        {items.map((item) => (
          <li key={item} className="flex gap-3 border-b border-dashed border-border py-3 text-[15px] leading-6 text-fg last:border-b-0">
            <CheckCircle size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
