import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { FilingStatus } from "@/lib/domain/filing-status";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { FILE_STEPS, nextCustomerStep, type StepInput } from "./steps";

interface Waiting {
  title: string;
  body: string;
  tone: "neutral" | "success" | "warning";
}

function waitingCopy(status: FilingStatus, hasDocuments: boolean): Waiting | null {
  switch (status) {
    case "ready_for_review":
      return { tone: "neutral", title: "Nothing needed from you right now", body: "We're reviewing your information before filing. We'll email you if anything needs your attention." };
    case "ready_to_file":
    case "in_progress":
      return { tone: "neutral", title: "Nothing needed from you right now", body: "Your filing is prepared and on its way to the state. We'll email you when it's submitted." };
    case "submitted":
      return { tone: "neutral", title: "Waiting on the state", body: "Your filing is with the state. We'll let you know as soon as it's accepted." };
    case "accepted":
      return { tone: "success", title: "Accepted by the state", body: hasDocuments ? "Your documents are below." : "We'll add the state's receipt below as soon as we have it." };
    case "completed":
      return { tone: "success", title: "All done", body: hasDocuments ? "Your filed report and receipt are below. Keep them with your business records." : "This filing is complete." };
    case "rejected":
      return { tone: "warning", title: "The state didn't accept this filing", body: "We're looking into it and will contact you with next steps." };
    default:
      return null;
  }
}

const toneStyles = {
  action: "border-accent/30 bg-accent-soft",
  neutral: "border-border bg-surface",
  success: "border-accent/25 bg-accent-soft",
  warning: "border-warning/30 bg-warning-soft",
} as const;

/** "What happens next" for a filing: one clear action, or a calm status note. */
export function NextStepCard({ filing, hasDocuments }: { filing: StepInput; hasDocuments: boolean }) {
  const step = nextCustomerStep(filing);

  if (step.kind !== "none" && step.href) {
    return (
      <section
        aria-labelledby="next-step-title"
        className={cn("grid gap-4 rounded-[var(--radius-surface)] border p-5 sm:p-6", toneStyles.action)}
      >
        <div className="flex items-start gap-3">
          <ArrowRight size={20} weight="bold" className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="grid gap-1">
            <h2 id="next-step-title" className="text-lg font-semibold tracking-tight text-fg">
              {step.title}
            </h2>
            <p className="text-[15px] text-muted">{step.body}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href={step.href} size="lg" className="w-full sm:w-auto">
            {step.cta}
          </ButtonLink>
          {step.kind === "reply" ? (
            <Link
              href={FILE_STEPS.details(filing.id)}
              className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              Update your details
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  const waiting = waitingCopy(filing.status, hasDocuments);
  if (!waiting) return null;
  const Icon = waiting.tone === "success" ? CheckCircle : waiting.tone === "warning" ? WarningCircle : Clock;
  return (
    <section
      aria-labelledby="next-step-title"
      className={cn("flex items-start gap-3 rounded-[var(--radius-surface)] border p-5 sm:p-6", toneStyles[waiting.tone])}
    >
      <Icon
        size={22}
        weight={waiting.tone === "success" ? "fill" : "regular"}
        className={cn("mt-0.5 shrink-0", waiting.tone === "success" ? "text-accent" : waiting.tone === "warning" ? "text-warning" : "text-muted")}
        aria-hidden
      />
      <div className="grid gap-1">
        <h2 id="next-step-title" className="text-lg font-semibold tracking-tight text-fg">
          {waiting.title}
        </h2>
        <p className="text-[15px] text-muted">{waiting.body}</p>
      </div>
    </section>
  );
}
