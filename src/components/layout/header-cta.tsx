"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** On the registered agent pages the main button starts that order; everywhere else it opens the annual report lookup. */
export function headerCta(pathname: string | null, agentPages: boolean): { href: string; label: string } {
  if (agentPages && pathname?.startsWith("/registered-agent")) {
    return { href: "/registered-agent/start", label: "Get a registered agent" };
  }
  return { href: "/find", label: "Find my business" };
}

export function HeaderCta({ agentPages, className }: { agentPages: boolean; className: string }) {
  const cta = headerCta(usePathname(), agentPages);
  return (
    <Link href={cta.href} prefetch={cta.href === "/find" ? undefined : false} className={className}>
      {cta.label}
    </Link>
  );
}

