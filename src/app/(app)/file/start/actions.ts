"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { ActionMessageState } from "@/components/funnel/types";
import { startOrderFromLookup } from "./start-order";

const modeSchema = z.enum(["file", "track"]).catch("file");

/** The "Confirm your business" button: start the order from the visitor's pending lookup. */
export async function confirmStart(_prev: ActionMessageState, formData: FormData): Promise<ActionMessageState> {
  const user = await requireUser("/file/start");
  const outcome = await startOrderFromLookup(user, modeSchema.parse(formData.get("mode")));
  if ("to" in outcome) redirect(outcome.to);
  return outcome;
}
