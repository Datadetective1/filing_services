import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

/** Internal operations console. Staff role is checked server-side on every request. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  const who = staff.displayName || staff.email;
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg lg:flex-row">
      {/* The global focus ring is pine, which disappears on ink. Swap it for marigold inside the sidebar. */}
      <style>{`.ops-ink :focus-visible { outline-color: var(--highlight); }`}</style>
      <a
        href="#admin-main"
        className="no-print sr-only rounded-full bg-surface px-4 py-2 text-sm font-semibold text-fg shadow-lift focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      {/* The ink column stretches with the page; its contents stay pinned while the page scrolls. */}
      <aside className="ops-ink no-print bg-ink text-ink-fg lg:w-60 lg:shrink-0">
        <div className="lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-y-auto">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-auto lg:px-5 lg:pb-4 lg:pt-5">
            <Logo href="/admin" tone="inverse" />
            <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-ink-muted lg:hidden">Ops · {staff.role}</span>
          </div>
          <AdminNav isAdmin={staff.role === "admin"} />
          <div className="hidden items-center gap-3 border-t border-white/10 px-5 py-4 lg:flex">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-2 font-display text-sm font-semibold uppercase text-highlight">
              {who.slice(0, 1)}
            </span>
            <div className="grid min-w-0">
              <p className="truncate text-sm font-medium text-ink-fg" title={who}>
                {who}
              </p>
              <p className="text-xs capitalize text-ink-muted">{staff.role}, operations</p>
            </div>
          </div>
        </div>
      </aside>
      <main id="admin-main" className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8 xl:px-10">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </main>
    </div>
  );
}
