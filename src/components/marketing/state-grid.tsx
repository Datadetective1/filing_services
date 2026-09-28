import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { isStateVerified, listJurisdictions } from "@/lib/compliance/registry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";

/**
 * All 50 states + DC with an honest status. Only states with verified rules say
 * "Supported"; everything else is "Not yet verified", never implied otherwise.
 */
export function StateGrid({ basePath, className }: { basePath: "/annual-report" | "/states"; className?: string }) {
  const states = listJurisdictions()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {states.map((j) => {
        const verified = isStateVerified(j.code);
        return (
          <li key={j.code}>
            <Link
              href={`${basePath}/${j.slug}`}
              className={cn(
                "group flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] border px-3.5 py-2.5 transition-colors",
                verified
                  ? "border-accent/30 bg-accent-soft/60 hover:border-accent/60"
                  : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
              )}
            >
              <span className={cn("text-[15px]", verified ? "font-medium text-fg" : "text-fg")}>{j.name}</span>
              <span className="flex items-center gap-2">
                {verified ? <Badge tone="success">Supported</Badge> : <span className="text-xs text-subtle">Not yet verified</span>}
                <ArrowRight
                  size={14}
                  aria-hidden
                  className="text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
