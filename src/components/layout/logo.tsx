import Link from "next/link";
import { site } from "@/config/site";
import { cn } from "@/components/ui/cn";

/** Wordmark with the Filewell mark: a filed page on pine, its corner folded in marigold. */
export function Logo({ href = "/", tone = "default" }: { href?: string; tone?: "default" | "inverse" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)]",
        tone === "inverse" ? "text-ink-fg" : "text-fg",
      )}
      aria-label={`${site.name} home`}
    >
      <LogoMark />
      <span className="font-display text-[21px] font-semibold tracking-[-0.03em]">{site.name}</span>
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block size-8 shrink-0 rounded-[10px] bg-accent", className)}>
      <span className="absolute left-[9px] top-[7px] h-[18px] w-[14px] rounded-[2.5px] bg-white" />
      <span className="absolute left-[17px] top-[7px] size-[6px] rounded-bl-[2px] rounded-tr-[2.5px] bg-highlight" />
      <span className="absolute left-[11.5px] top-[15px] h-[2px] w-[9px] rounded-full bg-accent/35" />
      <span className="absolute left-[11.5px] top-[19px] h-[2px] w-[6px] rounded-full bg-accent/35" />
    </span>
  );
}
