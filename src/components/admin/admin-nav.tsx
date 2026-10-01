"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BellSimple,
  ChartBar,
  ClockCounterClockwise,
  CreditCard,
  EnvelopeSimple,
  MegaphoneSimple,
  Scales,
  Storefront,
  SunHorizon,
  Tag,
  Tray,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/components/ui/cn";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/admin", label: "Today", icon: SunHorizon },
      { href: "/admin/queue", label: "Queue", icon: Tray },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/pricing", label: "Pricing", icon: Tag },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/admin/reminders", label: "Reminders", icon: BellSimple },
      { href: "/admin/notifications", label: "Emails", icon: EnvelopeSimple },
      { href: "/admin/outreach", label: "Outreach", icon: MegaphoneSimple },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/admin/analytics", label: "Funnel", icon: ChartBar },
      { href: "/admin/rules", label: "State rules", icon: Scales },
      { href: "/admin/audit", label: "Audit log", icon: ClockCounterClockwise },
    ],
  },
];

const ITEMS = GROUPS.flatMap((g) => g.items);

/** The nav item that owns a path. Filing pages are opened from the queue. */
function sectionFor(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin") return "/admin";
  if (path.startsWith("/admin/filings/")) return "/admin/queue";
  return ITEMS.find((i) => i.href !== "/admin" && (path === i.href || path.startsWith(`${i.href}/`)))?.href ?? null;
}

const linkBase =
  "relative flex min-h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[var(--radius-control)] px-3 text-[14.5px] font-medium transition-colors";

/**
 * Console navigation. A vertical, grouped list in the ink sidebar on large screens;
 * a single sideways-scrolling row under the top bar on small ones. The current
 * page is marked with aria-current="page" (and "true" on the parent section of a
 * detail page, such as the queue while a filing is open).
 */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  const section = sectionFor(pathname);
  const exact = pathname.replace(/\/+$/, "") || "/";
  const navRef = useRef<HTMLElement>(null);

  // On the scrolling phone row, bring the current item into view.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    const active = nav.querySelector<HTMLElement>("[aria-current]");
    if (!active) return;
    const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    nav.scrollLeft = Math.max(0, left);
  }, [section]);

  return (
    <nav
      ref={navRef}
      aria-label="Operations"
      className="relative flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-1 lg:flex-col lg:gap-6 lg:overflow-visible lg:px-3 lg:pb-4 lg:pt-2"
    >
      {GROUPS.map((group) => (
        <div key={group.label} className="flex gap-1 lg:grid lg:gap-0.5">
          <p className="hidden px-3 pb-1.5 text-xs font-semibold text-ink-muted lg:block">{group.label}</p>
          <ul className="flex gap-1 lg:grid lg:gap-0.5">
            {group.items.map((item) => {
              const active = section === item.href;
              const current = active ? (exact === item.href ? "page" : "true") : undefined;
              const ItemIcon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current}
                    className={cn(
                      linkBase,
                      active ? "bg-white/[0.09] text-ink-fg" : "text-ink-muted hover:bg-white/[0.05] hover:text-ink-fg",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden
                        className="absolute inset-x-3 bottom-1 h-[3px] rounded-full bg-highlight lg:inset-x-auto lg:bottom-2.5 lg:left-0 lg:top-2.5 lg:h-auto lg:w-[3px]"
                      />
                    ) : null}
                    <ItemIcon size={18} weight={active ? "fill" : "regular"} aria-hidden className={active ? "text-highlight" : undefined} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex lg:mt-auto lg:border-t lg:border-white/10 lg:pt-4">
        <Link href="/dashboard" className={cn(linkBase, "text-ink-muted hover:bg-white/[0.05] hover:text-ink-fg")}>
          <Storefront size={18} aria-hidden />
          Customer view
        </Link>
      </div>
    </nav>
  );
}
