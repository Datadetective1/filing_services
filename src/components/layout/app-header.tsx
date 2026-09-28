import Link from "next/link";
import { getCurrentUser, getStaff } from "@/lib/auth/session";
import { Container } from "@/components/ui/surface";
import { Logo } from "./logo";

export async function AppHeader() {
  const [user, staff] = await Promise.all([getCurrentUser(), getStaff()]);
  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo href="/dashboard" />
        <nav aria-label="Account" className="flex items-center gap-1 text-sm">
          <Link href="/dashboard" className="rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg">
            Dashboard
          </Link>
          <Link href="/dashboard/settings" className="hidden rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg sm:inline-block">
            Settings
          </Link>
          {staff ? (
            <Link href="/admin" className="rounded-[var(--radius-control)] px-3 py-2 font-medium text-accent hover:text-accent-hover">
              Admin
            </Link>
          ) : null}
          <span className="mx-2 hidden max-w-48 truncate text-subtle md:inline" title={user?.email}>
            {user?.email}
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="rounded-[var(--radius-control)] px-3 py-2 text-muted hover:text-fg">
              Sign out
            </button>
          </form>
        </nav>
      </Container>
    </header>
  );
}
