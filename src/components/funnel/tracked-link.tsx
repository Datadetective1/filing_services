"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics/client";
import type { AnalyticsEvent } from "@/lib/analytics/events";

/** A link that records a first-party analytics event when clicked. */
export function TrackedLink({
  href,
  event,
  stateCode,
  entityType,
  external,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEvent;
  stateCode?: string;
  entityType?: string;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const onClick = () => track(event, { stateCode, entityType });
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
