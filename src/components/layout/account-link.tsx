"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buttonClasses } from "@/components/ui/button";

const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/;
const noopSubscribe = () => () => {};

/**
 * Header account link. Marketing pages are statically generated, so the server can't
 * know who is signed in; on the client this shows "Dashboard" when a Supabase session
 * cookie is present. (Presence only: the dashboard itself verifies the session.)
 */
export function AccountLink() {
  const signedIn = useSyncExternalStore(
    noopSubscribe,
    () => SESSION_COOKIE.test(document.cookie),
    () => false,
  );
  return (
    <Link href={signedIn ? "/dashboard" : "/login"} className={buttonClasses("secondary", "sm", "ml-2")}>
      {signedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}
