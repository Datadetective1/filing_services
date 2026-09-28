import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Dense data table primitives (admin). Wrap in TableScroll for horizontal overflow on small screens. */
export function TableScroll({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-x-auto rounded-[var(--radius-surface)] border border-border bg-surface", className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-2 text-xs text-muted", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("whitespace-nowrap px-3 py-2.5 font-medium", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-t border-border", className)} {...props} />;
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2.5 align-top text-fg", className)} {...props} />;
}
