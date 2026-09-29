import { getCurrentUser, getStaff } from "@/lib/auth/session";
import { Container } from "@/components/ui/surface";
import { AppMobileMenu, AppNavLinks } from "./app-nav";
import { Logo } from "./logo";

/** Signed-in header for the dashboard and the filing flow. Same shape as the public header, quieter. */
export async function AppHeader() {
  const [user, staff] = await Promise.all([getCurrentUser(), getStaff()]);
  const email = user?.email ?? null;
  const isStaff = Boolean(staff);
  return (
    <header className="border-b border-border/80 bg-bg">
      <Container className="relative flex h-[68px] items-center justify-between gap-4">
        <Logo href="/dashboard" />
        <div className="flex items-center gap-1 max-sm:hidden">
          <nav aria-label="Account" className="flex items-center gap-1">
            <AppNavLinks isStaff={isStaff} />
          </nav>
          <span aria-hidden className="mx-2 h-6 w-px bg-border-strong/70" />
          {email ? (
            <span className="mr-1 flex min-w-0 items-center gap-2 max-md:hidden" title={email}>
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold uppercase text-accent-soft-fg"
              >
                {email.slice(0, 1)}
              </span>
              <span className="max-w-52 truncate text-sm text-muted">{email}</span>
            </span>
          ) : null}
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full px-3.5 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
        <AppMobileMenu email={email} isStaff={isStaff} />
      </Container>
    </header>
  );
}
