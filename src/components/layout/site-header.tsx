import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { AccountLink } from "./account-link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SITE_NAV } from "./site-nav";

/** Static header (no per-request auth lookup) so marketing and SEO pages can be prerendered. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg/80">
      <Container className="relative flex h-[68px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {SITE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1.5">
          <AccountLink className="max-lg:hidden" />
          <Link href="/find" className={buttonClasses("primary", "sm", "px-4 max-[369px]:hidden sm:px-5")}>
            Find my business
          </Link>
          <MobileMenu />
        </div>
      </Container>
    </header>
  );
}
