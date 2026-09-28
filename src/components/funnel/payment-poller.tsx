"use client";

import { CircleNotch } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";

/**
 * While the payment provider's confirmation is in flight, re-render the server
 * page every few seconds (the page re-verifies the session with the provider).
 * Gives up after a bounded number of tries and points to the dashboard.
 */
export function PaymentPoller({
  dashboardHref,
  maxAttempts = 10,
  intervalMs = 3000,
}: {
  dashboardHref: string;
  maxAttempts?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const done = attempts >= maxAttempts;

  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempts((a) => a + 1);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [attempts, done, intervalMs, router]);

  return (
    <div aria-live="polite" className="grid gap-4">
      {done ? (
        <>
          <p className="text-[15px] text-muted">
            This is taking longer than usual. Your payment may still be processing. We&apos;ll email you as soon as it&apos;s
            confirmed, and your dashboard will show the latest status.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={dashboardHref} className={buttonClasses("primary", "lg")}>
              Go to your dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                router.refresh();
                setAttempts(Math.max(0, maxAttempts - 3));
              }}
              className={buttonClasses("secondary", "lg")}
            >
              Check again
            </button>
          </div>
        </>
      ) : (
        <p className="flex items-center gap-2 text-[15px] text-muted">
          <CircleNotch size={20} className="animate-spin text-fg" aria-hidden />
          Checking with the payment provider. This usually takes a few seconds.
        </p>
      )}
    </div>
  );
}
