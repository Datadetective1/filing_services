"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buttonClasses } from "@/components/ui/button";

const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;
const noopSubscribe = () => () => {};

/** Presence check only: the dashboard itself verifies the session. */
export function useHasSessionCookie(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => SESSION_COOKIE.test(document.cookie),
    () => false,
  );
}

/**
 * Header account link. Marketing pages are statically generated, so the server can't
 * know who is signed in; on the client this shows "Dashboard" when a Supabase session
 * cookie is present.
 */
export function AccountLink({ className }: { className?: string }) {
  const signedIn = useHasSessionCookie();
  return (
    <Link href={signedIn ? "/dashboard" : "/login"} className={buttonClasses("ghost", "sm", className)}>
      {signedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}
