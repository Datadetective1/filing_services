import Link from "next/link";
import { Container } from "@/components/ui/surface";
import { AccountLink } from "./account-link";
import { Logo } from "./logo";

/** Static header (no per-request auth lookup) so marketing and SEO pages can be prerendered. */
export function SiteHeader() {
  return (
    <header className="border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 text-sm">
          <Link href="/annual-report" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg sm:inline-block">
            Annual reports
          </Link>
          <Link href="/states" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg sm:inline-block">
            States
          </Link>
          <Link href="/pricing" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg md:inline-block">
            Pricing
          </Link>
          <AccountLink />
        </nav>
      </Container>
    </header>
  );
}
