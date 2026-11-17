"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses } from "@/components/ui/button";
import { track } from "@/lib/analytics/client";

type Variant = Parameters<typeof buttonClasses>[0];
type Size = Parameters<typeof buttonClasses>[1];

/**
 * "Have us file it" goes through /annual-report/start, which forgets an earlier registered
 * agent choice before opening the lookup, so the order that follows is the annual report.
 */
export function annualReportLookupHref(href: ComponentProps<typeof Link>["href"]): ComponentProps<typeof Link>["href"] {
  if (typeof href !== "string" || !(href === "/find" || href.startsWith("/find?"))) return href;
  return `/annual-report/start${href.slice("/find".length)}`;
}

/** "Have us file it" link styled as a button. Records filing_cta_clicked on click. */
export function FilingCtaLink({
  stateCode,
  entityType,
  variant = "primary",
  size = "lg",
  className,
  href,
  prefetch,
  ...props
}: Omit<ComponentProps<typeof Link>, "onClick"> & {
  stateCode?: string;
  entityType?: string;
  variant?: Variant;
  size?: Size;
}) {
  return (
    <Link
      {...props}
      href={annualReportLookupHref(href)}
      // The start route sets a cookie on a real visit, so it is never prefetched.
      prefetch={typeof href === "string" && href !== annualReportLookupHref(href) ? false : prefetch}
      className={buttonClasses(variant, size, className)}
      onClick={() => track("filing_cta_clicked", { stateCode, entityType })}
    />
  );
}
