"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { useHasSessionCookie } from "./account-link";
import { SITE_NAV } from "./site-nav";

/** Small-screen navigation. Closes on route change, Escape, or a tap outside. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const pathname = usePathname();
  const signedIn = useHasSessionCookie();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  // Navigating away closes the menu (derived, no effect needed).
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
    <div ref={root} className="lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(!isOpen);
        }}
        className="inline-flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2"
      >
        {isOpen ? <X size={22} weight="bold" aria-hidden /> : <List size={22} weight="bold" aria-hidden />}
        <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        className="absolute inset-x-0 top-full border-b border-border bg-bg px-4 pb-5 pt-2 shadow-lift sm:px-6"
      >
        <nav aria-label="Main" className="grid">
          {SITE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="flex min-h-12 items-center border-b border-border text-[17px] font-semibold text-fg aria-[current=page]:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 grid gap-2">
          <Link href="/find" className={buttonClasses("primary", "lg")}>
            Find my business
          </Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className={buttonClasses("secondary", "lg")}>
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      </div>
    </div>
  );
}
