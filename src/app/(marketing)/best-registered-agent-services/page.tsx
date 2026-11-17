import type { Metadata } from "next";
import { BestOfPage, bestOfMetadata } from "@/components/marketing/best-of-page";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return bestOfMetadata("registered-agent");
}

export default function Page() {
  return <BestOfPage kind="registered-agent" />;
}
