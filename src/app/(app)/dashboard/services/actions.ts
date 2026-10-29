"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { PaymentConfigurationError } from "@/lib/payments/types";
import { setRenewal, ServiceOrderError, startServiceCheckout, validateServiceCheckoutInput } from "@/lib/services/orders";
import type { ActionMessageState } from "@/components/funnel/types";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** Registered agent checkout: validate, re-authorize, quote on the server, then hosted checkout. */
export async function startServiceCheckoutAction(_prev: ActionMessageState, formData: FormData): Promise<ActionMessageState> {
  const user = await requireUser("/dashboard");
  const raw = Object.fromEntries(formData.entries());
  const parsed = validateServiceCheckoutInput(raw);
  if (!parsed.ok) return { error: parsed.error };
  if (!uuid.safeParse(parsed.value.businessId).success) return { error: "Business not found." };
  let url: string | null = null;
  try {
    url = (await startServiceCheckout(user, parsed.value)).url;
  } catch (e) {
    if (e instanceof ServiceOrderError) return { error: e.message };
    if (e instanceof PaymentConfigurationError) return { error: "Online payment isn't available right now. Nothing has been charged." };
    console.error("[services] checkout failed", e);
    return { error: "We couldn't start checkout. Nothing has been charged. Please try again." };
  }
  redirect(url);
}

/** Turn renewal off or back on. Never ends the paid year early. */
export async function setRenewalAction(_prev: ActionMessageState, formData: FormData): Promise<ActionMessageState> {
  const user = await requireUser("/dashboard");
  const id = uuid.safeParse(formData.get("subscriptionId"));
  const renew = formData.get("renew") === "true";
  if (!id.success) return { error: "Service not found." };
  try {
    await setRenewal(user, id.data, renew);
  } catch (e) {
    if (e instanceof ServiceOrderError) return { error: e.message };
    console.error("[services] renewal change failed", e);
    return { error: "We couldn't change renewal. Please try again." };
  }
  refresh();
  return {};
}
