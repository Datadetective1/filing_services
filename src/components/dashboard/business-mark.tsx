import { cn } from "@/components/ui/cn";

const SUFFIXES = new Set(["llc", "l.l.c.", "inc", "inc.", "corp", "corp.", "co", "co.", "ltd", "ltd.", "lp", "llp", "pllc", "pc", "the"]);

const TINTS = [
  "bg-accent-soft text-accent-soft-fg",
  "bg-highlight-soft text-highlight-fg",
  "bg-info-soft text-info",
  "bg-surface-3 text-fg",
] as const;

/** Two letters for a business, skipping "&", "The" and entity suffixes. */
export function businessInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9.]/g, ""))
    .filter((w) => /[A-Za-z0-9]/.test(w) && !SUFFIXES.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join("") || name.trim().slice(0, 1).toUpperCase() || "B";
}

function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * A business's mark: its initials on a calm tint (stable per business), so each
 * business reads as a thing you own rather than a row.
 */
export function BusinessMark({ id, name, size = "md", className }: { id: string; name: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center font-display font-semibold tracking-[-0.02em]",
        size === "lg" ? "size-16 rounded-[18px] text-2xl sm:size-[72px] sm:text-[28px]" : "size-12 rounded-[14px] text-lg",
        tintFor(id),
        className,
      )}
    >
      {businessInitials(name)}
    </span>
  );
}
