import { ArrowRight, BellRinging, EnvelopeSimpleOpen } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { site } from "@/config/site";
import { DEFAULT_REMINDER_OFFSETS } from "@/lib/domain/reminders";
import { Photo } from "@/components/media/photo";
import { ButtonLink } from "@/components/ui/button";

const STEPS = [
  "Tell us your state, your type of business and its name.",
  "See the deadline, the state fee and the official source.",
  "Get reminders, or have us file it for you.",
];

function reminderLead(): string {
  const before = DEFAULT_REMINDER_OFFSETS.filter((o) => o < 0)
    .slice(0, 3)
    .map((o) => Math.abs(o));
  if (before.length < 3) return "We email you ahead of each deadline.";
  return `We email you ${before[0]}, ${before[1]} and ${before[2]} days ahead, then closer to the date.`;
}

/**
 * Getting started, for an account with no businesses yet. Someone who came for a registered
 * agent ("first") sees that order straight away; otherwise the annual report lookup leads and
 * the agent is offered underneath ("offer") while those pages are on.
 */
export function EmptyDashboard({ agent = null }: { agent?: "first" | "offer" | null }) {
  if (agent === "first") return <AgentFirst />;
  return (
    <section
      aria-labelledby="welcome-title"
      className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16"
    >
      <div className="grid content-start gap-8">
        <div className="grid gap-4">
          <p className="text-sm font-semibold text-accent">Welcome to {site.name}</p>
          <h1
            id="welcome-title"
            className="max-w-[15ch] text-[38px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]"
          >
            Let&apos;s find your <span className="mark-highlight">first business</span>.
          </h1>
          <p className="max-w-[42ch] text-lg leading-relaxed text-muted">
            Look it up once. You&apos;ll see what it needs to file and when, and we&apos;ll remind you before each deadline.
          </p>
        </div>

        <ol className="grid gap-3.5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[16px] leading-7 text-fg">
              <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border-strong bg-surface font-display text-sm font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <ButtonLink href="/find" size="lg">
            Find my business
            <ArrowRight size={18} weight="bold" aria-hidden />
          </ButtonLink>
          <p className="text-center text-sm text-muted sm:text-left">It takes about a minute.</p>
        </div>
        {agent === "offer" ? (
          <p className="text-[15px] text-muted">
            Here for a registered agent instead?{" "}
            <Link href="/registered-agent" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              Get one for your business
            </Link>
          </p>
        ) : null}
      </div>

      <div className="relative">
        <Photo
          photo="woodworker"
          priority
          sizes="(min-width: 1024px) 46vw, 100vw"
          className="aspect-[4/3] lg:aspect-[5/4]"
          focus="55% 40%"
        />
        <div className="relative z-10 mx-4 -mt-12 flex items-start gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-lift sm:absolute sm:bottom-6 sm:left-6 sm:mx-0 sm:mt-0 sm:max-w-[20rem]">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
            <BellRinging size={20} weight="fill" aria-hidden />
          </span>
          <div className="grid gap-0.5">
            <p className="font-display text-[16px] font-semibold text-fg">Reminders before it&apos;s urgent</p>
            <p className="text-sm leading-6 text-muted">{reminderLead()}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentFirst() {
  return (
    <section aria-labelledby="welcome-title" className="grid max-w-2xl gap-8">
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-accent">Welcome to {site.name}</p>
        <h1 id="welcome-title" className="text-[38px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]">
          Let&apos;s set up your <span className="mark-highlight">registered agent</span>.
        </h1>
        <p className="max-w-[46ch] text-lg leading-relaxed text-muted">
          Tell us which business it&apos;s for. You see the full price before you pay.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/registered-agent/start" prefetch={false} size="lg">
          I already have a business
          <ArrowRight size={18} weight="bold" aria-hidden />
        </ButtonLink>
        <ButtonLink href="/dashboard/services/new-business" size="lg" variant="secondary">
          I&apos;m starting a business
        </ButtonLink>
      </div>
      <p className="flex items-start gap-2 text-[15px] text-muted">
        <EnvelopeSimpleOpen size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0" />
        Legal mail is scanned to your dashboard, and we email you when it arrives.
      </p>
    </section>
  );
}
