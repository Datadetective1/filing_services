import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * A document drawn as a sheet of paper (folded corner, ruled lines), so receipts
 * and confirmations read as objects you keep rather than rows in a table.
 */
export function DocumentSheet({
  title,
  subtitle,
  stamp,
  className,
  size = "md",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Short stamp text, e.g. "Accepted". */
  stamp?: ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[6px] border border-border bg-surface shadow-card",
        size === "xs" ? "h-[46px] w-[36px] rounded-[4px] p-1.5" : size === "sm" ? "h-[88px] w-[70px] p-2" : "h-[148px] w-[118px] p-3",
        className,
      )}
      aria-hidden
    >
      <span
        className={cn(
          "absolute right-0 top-0 rounded-bl-[6px] bg-surface-3",
          size === "xs" ? "size-2.5 rounded-bl-[3px]" : size === "sm" ? "size-4" : "size-6",
        )}
      />
      <span className={cn("block rounded-full bg-accent/80", size === "xs" ? "h-0.5 w-3" : size === "sm" ? "h-1 w-6" : "h-1.5 w-9")} />
      <span className={cn("grid", size === "xs" ? "mt-1 gap-1" : "mt-2 gap-1.5")}>
        <span className={cn("w-full rounded-full bg-surface-3", size === "xs" ? "h-0.5" : "h-1")} />
        <span className={cn("w-5/6 rounded-full bg-surface-3", size === "xs" ? "h-0.5" : "h-1")} />
        {size !== "xs" ? <span className="h-1 w-4/6 rounded-full bg-surface-3" /> : null}
        {size === "md" ? (
          <>
            <span className="h-1 w-full rounded-full bg-surface-3" />
            <span className="h-1 w-3/6 rounded-full bg-surface-3" />
          </>
        ) : null}
      </span>
      {stamp && size !== "xs" ? (
        <span
          className={cn(
            "absolute -rotate-[8deg] rounded-[4px] border-2 border-accent font-bold uppercase tracking-wider text-accent",
            size === "sm" ? "bottom-2 left-1.5 px-1 text-[8px]" : "bottom-4 left-3 px-1.5 py-0.5 text-[10px]",
          )}
        >
          {stamp}
        </span>
      ) : null}
      <span className="sr-only">
        {title}
        {subtitle ? `, ${subtitle}` : ""}
      </span>
    </div>
  );
}

/** Document sheet plus its label, for grids of documents. */
export function DocumentTile({
  title,
  subtitle,
  stamp,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  stamp?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4", className)}>
      <DocumentSheet title={title} subtitle={subtitle} stamp={stamp} size="sm" />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="flex items-center gap-1.5 font-semibold text-fg">
          {stamp ? <SealCheck size={16} weight="fill" aria-hidden className="shrink-0 text-accent" /> : null}
          <span className="truncate">{title}</span>
        </p>
        {subtitle ? <div className="text-sm text-muted">{subtitle}</div> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}
