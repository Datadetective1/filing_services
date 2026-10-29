import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { loadFormationStatus } from "@/lib/services/formation";
import { backLinkClass } from "@/components/dashboard/section";
import { Card, Container, Notice } from "@/components/ui/surface";

export const metadata: Metadata = {
  title: "Your formation",
  robots: { index: false, follow: false },
};

const PLACED = ["submitted_to_provider", "processing", "completed"];

/** Where a formation order stands, from recorded statuses only. No dates are promised. */
export default async function FormationStatusPage(
  props: PageProps<"/dashboard/services/formation/[orderId]">,
) {
  const { orderId } = await props.params;
  const sp = await props.searchParams;
  const user = await requireUser(`/dashboard/services/formation/${orderId}`);
  const status = await loadFormationStatus(
    user,
    orderId,
    typeof sp.session_id === "string" ? sp.session_id : null,
  );
  if (!status) notFound();
  const steps = [
    { label: "Payment confirmed", done: status.paid },
    {
      label: "We file with the state",
      done: PLACED.includes(status.filingStatus),
    },
    {
      label: `${status.stateName} approves the filing`,
      done: status.filingStatus === "completed",
    },
  ];
  const firstOpen = steps.findIndex((s) => !s.done);
  return (
    <Container className="max-w-2xl py-6 sm:py-12">
      <Link
        href={`/dashboard/businesses/${status.businessId}`}
        className={backLinkClass}
      >
        <ArrowLeft size={16} weight="bold" aria-hidden />
        {status.businessName}
      </Link>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight text-fg [overflow-wrap:anywhere] sm:text-[34px]">
        Forming {status.businessName}
      </h1>
      {status.filingStatus === "information_needed" ? (
        <Notice
          className="mt-5"
          tone="warning"
          title="We need something from you"
        >
          <p>
            We&apos;ve emailed you what it is. Your filing waits until we hear
            back.
          </p>
        </Notice>
      ) : null}
      <Card className="mt-6 p-4 sm:p-6">
        <h2 className="text-[16px] font-semibold text-fg">What happens next</h2>
        <ol className="mt-4 grid gap-4">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start gap-3">
              {s.done ? (
                <CheckCircle
                  size={22}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-accent"
                  aria-hidden
                />
              ) : (
                <Circle
                  size={22}
                  weight={i === firstOpen ? "bold" : "regular"}
                  className="mt-0.5 shrink-0 text-subtle"
                  aria-hidden
                />
              )}
              <span
                className={s.done || i === firstOpen ? "text-fg" : "text-muted"}
              >
                {s.label}
                <span className="sr-only">
                  {s.done ? " (done)" : i === firstOpen ? " (in progress)" : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          The state&apos;s processing time varies. We email you when it approves
          the filing.
        </p>
      </Card>
      {status.subscriptionId ? (
        <p className="mt-5 text-sm text-muted">
          Your registered agent service:{" "}
          <Link
            href={`/dashboard/services/${status.subscriptionId}`}
            className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            see its status
          </Link>
        </p>
      ) : null}
    </Container>
  );
}
