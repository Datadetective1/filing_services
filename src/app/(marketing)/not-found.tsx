import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/not-found-content";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** 404 for pages in the marketing group, whose layout already draws the header and footer. */
export default function MarketingNotFound() {
  return <NotFoundContent />;
}
