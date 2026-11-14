"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** On the registered agent pages the main button starts that order; everywhere else it asks for the state first. */
export function headerCta(pathname: string | null, agentPages: boolean): { href: string; label: string } {
  if (agentPages && pathname?.startsWith("/registered-agent")) {
    return { href: "/registered-agent/start", label: "Get a registered agent" };
  }
  return { href: "/services", label: "Pick your state" };
}

export function HeaderCta({ agentPages, className }: { agentPages: boolean; className: string }) {
  const cta = headerCta(usePathname(), agentPages);
  return (
    <Link href={cta.href} prefetch={cta.href === "/services" ? undefined : false} className={className}>
      {cta.label}
    </Link>
  );
}

