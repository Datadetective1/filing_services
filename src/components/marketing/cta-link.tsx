"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonClasses } from "@/components/ui/button";
import { track } from "@/lib/analytics/client";

type Variant = Parameters<typeof buttonClasses>[0];
type Size = Parameters<typeof buttonClasses>[1];

/** "Have us file it" link styled as a button. Records filing_cta_clicked on click. */
export function FilingCtaLink({
  stateCode,
  entityType,
  variant = "primary",
  size = "lg",
  className,
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
      className={buttonClasses(variant, size, className)}
      onClick={() => track("filing_cta_clicked", { stateCode, entityType })}
    />
  );
}
