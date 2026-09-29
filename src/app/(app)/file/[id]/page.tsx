import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CUSTOMER_EDITABLE_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import { validateAll } from "@/lib/intake/validate";
import { loadOwnFiling } from "../_lib/filing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** /file/<id> sends the customer to the right step for the filing's current state. */
export default async function FilingIndexPage({ params }: PageProps<"/file/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/file/${id}`);
  const loaded = await loadOwnFiling(user, id);
  if (!loaded) notFound();
  const status = loaded.filing.status as FilingStatus;
  if (!CUSTOMER_EDITABLE_STATUSES.includes(status)) redirect(`/dashboard/filings/${id}`);
  redirect(validateAll(loaded.schema, loaded.answers).ok ? `/file/${id}/review` : `/file/${id}/details`);
}
