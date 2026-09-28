import Link from "next/link";
import { site } from "@/config/site";

/** Wordmark with a simple geometric mark (a filed page corner). */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-[var(--radius-control)] text-fg" aria-label={`${site.name} home`}>
      <span aria-hidden className="relative inline-block size-6 rounded-[6px] bg-fg">
        <span className="absolute right-0 top-0 size-2.5 rounded-bl-[4px] rounded-tr-[6px] bg-accent" />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">{site.name}</span>
    </Link>
  );
}
