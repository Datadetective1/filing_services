import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { RA_JURISDICTIONS } from "@/lib/registered-agent/jurisdictions";
import {
  businessServicesPagesEnabled,
  raSaleCheck,
} from "@/lib/registered-agent/sales";
import { backLinkClass } from "@/components/dashboard/section";
import { NewBusinessForm } from "@/components/services/new-business-form";
import { Card, Container, Notice } from "@/components/ui/surface";
import { addFormingBusinessAction } from "../actions";

export const metadata: Metadata = {
  title: "Registered agent for a new business",
  robots: { index: false, follow: false },
};

/**
 * Registered agent service for a business the customer is forming themselves: they name us in
 * their formation filing, so there is no change filing. Only states where that can be ordered
 * right now are listed, so nobody picks a state and then hits a dead end.
 */
export default async function NewBusinessAgentPage(
  props: PageProps<"/dashboard/services/new-business">,
) {
  if (!businessServicesPagesEnabled()) notFound();
  await requireUser("/dashboard/services/new-business");
  const sp = await props.searchParams;
  const states = RA_JURISDICTIONS.filter(
    (j) =>
      raSaleCheck(j.code, "llc", "new_entity").ok ||
      raSaleCheck(j.code, "corporation", "new_entity").ok,
  ).map((j) => ({ code: j.code, name: j.name }));
  const wanted = typeof sp.state === "string" ? sp.state.toUpperCase() : "";
  return (
    <Container className="max-w-2xl py-6 sm:py-12">
      <Link href="/dashboard" className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden />
        Dashboard
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight text-fg sm:text-[34px]">
        Registered agent for a new business
      </h1>
      <p className="mt-2 max-w-[60ch] text-[15px] text-muted">
        Forming the business yourself? Tell us where, and we&apos;ll give you
        our agent&apos;s name and address to put in your filing. No change
        filing, no extra state fee from us.
      </p>
      <div className="mt-6 grid gap-5">
        {states.length === 0 ? (
          <Notice tone="warning" title="Not open yet">
            <p>
              Registered agent service for new businesses isn&apos;t open yet.
              Nothing has been charged.
            </p>
          </Notice>
        ) : (
          <Card className="p-4 sm:p-6">
            <NewBusinessForm
              action={addFormingBusinessAction}
              states={states}
              defaultState={states.some((s) => s.code === wanted) ? wanted : ""}
            />
          </Card>
        )}
        <p className="text-sm text-muted">
          Want us to form it for you?{" "}
          <Link
            href="/dashboard/services/formation"
            className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            Business formation
          </Link>
        </p>
      </div>
    </Container>
  );
}
