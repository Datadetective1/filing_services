import type { Metadata } from "next";
import { guideMetadata, guideParams, StateGuidePage } from "@/components/marketing/state-guide-page";

export const dynamicParams = false;
// Deadline tables count days to each due date: refresh at least hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return guideParams("NV");
}

export async function generateMetadata({ params }: PageProps<"/nevada/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  return guideMetadata("NV", topic);
}

export default async function Page({ params }: PageProps<"/nevada/[topic]">) {
  const { topic } = await params;
  return <StateGuidePage stateCode="NV" topic={topic} />;
}
