import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { Logo } from "./logo";

export async function SiteHeader() {
  let signedIn = false;
  try {
    signedIn = Boolean(await getCurrentUser());
  } catch {
    signedIn = false;
  }
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
          {signedIn ? (
            <Link href="/dashboard" className={buttonClasses("secondary", "sm", "ml-2")}>
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className={buttonClasses("secondary", "sm", "ml-2")}>
              Sign in
            </Link>
          )}
        </nav>
      </Container>
    </header>
  );
}
