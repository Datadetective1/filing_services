import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Today" },
  { href: "/admin/queue", label: "Queue" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reminders", label: "Reminders" },
  { href: "/admin/notifications", label: "Emails" },
  { href: "/admin/analytics", label: "Funnel" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/rules", label: "State rules" },
  { href: "/admin/audit", label: "Audit log" },
];

/** Internal operations console. Staff role is checked server-side on every request. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <aside className="no-print border-b border-border bg-surface lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-4">
          <Logo href="/admin" />
          <span className="rounded-[var(--radius-control)] bg-surface-2 px-2 py-0.5 text-xs text-muted">{staff.role}</span>
        </div>
        <nav aria-label="Operations" className="flex gap-1 overflow-x-auto px-2 pb-3 text-sm lg:flex-col lg:overflow-visible">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-muted hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className="whitespace-nowrap rounded-[var(--radius-control)] px-3 py-2 text-subtle hover:text-fg lg:mt-4">
            Customer view
          </Link>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
