import type { Metadata } from "next";
import { guideMetadata, guideParams, StateGuidePage } from "@/components/marketing/state-guide-page";

export const dynamicParams = false;
// Deadline tables count days to each due date: refresh at least hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  return guideParams("UT");
}

export async function generateMetadata({ params }: PageProps<"/utah/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  return guideMetadata("UT", topic);
}

export default async function Page({ params }: PageProps<"/utah/[topic]">) {
  const { topic } = await params;
  return <StateGuidePage stateCode="UT" topic={topic} />;
}
