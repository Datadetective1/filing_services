import { Check, PaperPlaneTilt, PenNib } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { DocumentSheet } from "@/components/visual/document-tile";

/**
 * "Have us file it" in four steps, each drawn as the small piece of the product
 * the customer actually sees at that step.
 */
export function FilingProcess({ stateName, agency }: { stateName: string; agency: string }) {
  const steps: { title: string; body: string; visual: ReactNode }[] = [
    {
      title: "Answer a few questions",
      body: "Addresses and the people who run the business. Your progress saves as you go.",
      visual: (
        <div className="grid w-full gap-2">
          <span className="text-[11px] font-semibold text-muted">Registered office</span>
          <span className="flex h-8 items-center rounded-lg border border-border-strong bg-surface px-2.5 text-[12px] text-fg">
            214 Market Street
          </span>
          <span className="flex h-8 items-center rounded-lg border-2 border-accent/50 bg-surface px-2.5 text-[12px] text-subtle">
            City
            <span className="ml-0.5 h-3.5 w-px animate-pulse bg-fg" />
          </span>
        </div>
      ),
    },
    {
      title: "Review and authorize",
      body: "Check everything once, then sign. Nothing is filed without your say-so.",
      visual: (
        <div className="grid w-full gap-2">
          <span className="flex items-center gap-2 text-[12px] text-fg">
            <span className="grid size-4 place-items-center rounded bg-accent text-accent-fg">
              <Check size={10} weight="bold" />
            </span>
            Details are accurate
          </span>
          <span className="flex items-end gap-2 border-b-2 border-fg/70 pb-1">
            <PenNib size={16} className="text-accent" />
            <span className="font-display text-[19px] italic leading-none text-fg">Dana R.</span>
          </span>
        </div>
      ),
    },
    {
      title: "We prepare and submit",
      body: `A person on our team checks it and files it with the ${agency}.`,
      visual: (
        <div className="grid w-full gap-2">
          <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">
            <PaperPlaneTilt size={12} weight="fill" />
            Submitted to {stateName}
          </span>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full w-3/4 rounded-full bg-accent" />
          </span>
          <span className="text-[11px] text-muted">We email you at each step</span>
        </div>
      ),
    },
    {
      title: "Keep the state's confirmation",
      body: "The approved report and receipt stay in your dashboard.",
      visual: <DocumentSheet title="Approved annual report" stamp="Accepted" size="sm" className="rotate-[-3deg]" />,
    },
  ];

  return (
    <ol
      aria-label="Steps when we file for you"
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 lg:gap-0"
    >
      {steps.map((step, i) => (
        <li
          key={step.title}
          className="relative grid w-[80%] shrink-0 snap-start content-start gap-4 sm:w-auto lg:px-5 lg:first:pl-0 lg:last:pr-0"
        >
          {i > 0 ? <span aria-hidden className="absolute left-0 top-[4.5rem] hidden h-px w-5 bg-border-strong lg:block" /> : null}
          <div aria-hidden className="flex h-36 items-center justify-center rounded-[var(--radius-surface)] border border-border bg-surface p-5">
            {step.visual}
          </div>
          <div className="grid gap-1.5">
            <p className="flex items-center gap-2.5">
              <span className="tnum grid size-7 place-items-center rounded-full bg-highlight-soft font-display text-[13px] font-bold text-highlight-fg">
                {i + 1}
              </span>
              <span className="font-display text-lg font-semibold text-fg">{step.title}</span>
            </p>
            <p className="text-[15px] leading-6 text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
