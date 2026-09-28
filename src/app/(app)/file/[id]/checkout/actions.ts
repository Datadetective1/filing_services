"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { startCheckout } from "@/lib/filings/customer";
import { rateLimit } from "@/lib/security/rate-limit";
import type { ActionMessageState } from "@/components/funnel/types";
import { FILING_ID_RE, friendlyError } from "../../_lib/errors";
import { authorizationStatus, loadOwnFiling } from "../../_lib/filing";

/** Create the order + hosted checkout session, then send the customer to it. */
export async function payAction(filingId: string, _prev: ActionMessageState, _formData: FormData): Promise<ActionMessageState> {
  void _formData;
  if (!FILING_ID_RE.test(filingId)) return { error: "This page is out of date. Reload it and try again." };
  const user = await requireUser(`/file/${filingId}/checkout`);
  const loaded = await loadOwnFiling(user, filingId);
  if (!loaded) return { error: "We couldn't find this filing on your account.", href: "/dashboard", hrefLabel: "Go to your dashboard" };
  if (loaded.filing.status !== "draft") redirect(`/dashboard/filings/${filingId}`);

  // Each attempt creates processor sessions; cap it per user and per filing (fail closed).
  const allowed =
    (await rateLimit(`checkout:user:${user.id}`, 10, 600, { failClosed: true })) &&
    (await rateLimit(`checkout:filing:${filingId}`, 6, 600, { failClosed: true }));
  if (!allowed) return { error: "Too many checkout attempts. Wait a few minutes and try again." };

  const auth = await authorizationStatus(filingId, loaded.schema, loaded.answers);
  if (auth !== "current") redirect(`/file/${filingId}/review${auth === "stale" ? "?changed=1" : ""}`);

  let url: string;
  try {
    ({ url } = await startCheckout(user, filingId));
  } catch (e) {
    return { error: friendlyError(e) };
  }
  redirect(url);
}
