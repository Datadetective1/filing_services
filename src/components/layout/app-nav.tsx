"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

interface NavItem {
  href: string;
  label: string;
  staff?: boolean;
  match: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p === "/dashboard" || (p.startsWith("/dashboard/") && !p.startsWith("/dashboard/settings")),
  },
  { href: "/dashboard/settings", label: "Settings", match: (p) => p.startsWith("/dashboard/settings") },
  { href: "/admin", label: "Admin", staff: true, match: (p) => p.startsWith("/admin") },
];

function visible(isStaff: boolean) {
  return NAV.filter((item) => !item.staff || isStaff);
}

/** Signed-in navigation links for wide screens, with the current page marked. */
export function AppNavLinks({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname() ?? "";
  return (
    <>
      {visible(isStaff).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.match(pathname) ? "page" : undefined}
          className={cn(
            "inline-flex h-10 items-center rounded-full px-3.5 text-[15px] font-medium transition-colors hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-surface-2 aria-[current=page]:text-fg",
            item.staff ? "text-accent" : "text-muted",
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

/** Small-screen account menu. Closes on route change, Escape, or a tap outside. */
export function AppMobileMenu({ email, isStaff }: { email: string | null; isStaff: boolean }) {
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const pathname = usePathname() ?? "";
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const isOpen = open && openedOn === pathname;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [isOpen]);

  return (
    <div ref={root} className="sm:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(!isOpen);
        }}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-2"
      >
        {isOpen ? <X size={22} weight="bold" aria-hidden /> : <List size={22} weight="bold" aria-hidden />}
        <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute inset-x-0 top-full z-40 border-b border-border bg-bg px-4 pb-5 pt-1 shadow-lift"
      >
        {email ? (
          <p className="truncate border-b border-border py-3.5 text-sm text-muted" title={email}>
            Signed in as <span className="font-semibold text-fg">{email}</span>
          </p>
        ) : null}
        <nav aria-label="Account" className="grid">
          {visible(isStaff).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.match(pathname) ? "page" : undefined}
              className="flex min-h-12 items-center border-b border-border text-[17px] font-semibold text-fg aria-[current=page]:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="mt-4">
          <button type="submit" className={buttonClasses("secondary", "lg", "w-full")}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
