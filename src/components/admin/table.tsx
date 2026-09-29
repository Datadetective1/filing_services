import type { ComponentProps } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Console table primitives. Same names and props as `components/ui/table`, restyled
 * for the operations console: a quiet header, airy rows and a light hover. Wide
 * tables scroll inside their own frame, never the page.
 */

/**
 * Scrolling frame with its own border. Focusable so keyboard users can scroll it.
 * `inset` is the lighter frame for a table that sits inside a Panel.
 */
export function TableScroll({ className, variant = "frame", ...props }: ComponentProps<"div"> & { variant?: "frame" | "inset" }) {
  return (
    <div
      tabIndex={0}
      className={cn(
        "overflow-x-auto border border-border bg-surface",
        variant === "inset" ? "rounded-[var(--radius-control)]" : "rounded-[var(--radius-surface)] shadow-[0_1px_2px_rgb(23_35_29/0.04)]",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-border bg-bg text-[13px] text-muted", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("whitespace-nowrap px-3.5 py-3 font-semibold first:pl-5 last:pr-5", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-t border-border/70 transition-colors first:border-t-0 hover:bg-bg/70", className)} {...props} />;
}

/** `valign="top"` for rows whose cells expand (JSON disclosures, long notes). */
export function TD({ className, valign = "middle", ...props }: ComponentProps<"td"> & { valign?: "middle" | "top" }) {
  return (
    <td
      className={cn("px-3.5 py-3 text-fg first:pl-5 last:pr-5", valign === "top" ? "align-top" : "align-middle", className)}
      {...props}
    />
  );
}
