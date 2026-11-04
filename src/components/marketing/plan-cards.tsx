import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { formatCents } from "@/lib/domain/money";
import type { PlanOffers } from "@/lib/services/plan-offers";

interface Plan {
  title: string;
  /** Big number, like "$119". */
  price: string;
  /** Small text beside the number, like "a year". */
  unit: string;
  /** Small text above the number, like "From". */
  lead?: string;
  points: string[];
  href: string;
  cta: string;
  featured?: boolean;
}

function inStates(names: string[], count: number) {
  return names.length === 1 ? `In ${names[0]}` : `In ${count} states`;
}

/** The services we sell today, as plan cards. Shared by the homepage and pricing. */
export function plansFrom(o: PlanOffers): Plan[] {
  const plans: Plan[] = [];
  if (o.raCents !== undefined) {
    plans.push({
      title: "Registered agent",
      price: formatCents(o.raCents, { trimZeros: true }),
      unit: "a year",
      points: ["Every state", "Legal mail scanned to you", "Same price at renewal"],
      href: "/registered-agent",
      cta: "Get an agent",
    });
  }
  if (o.bundleCents !== undefined) {
    plans.push({
      title: "Agent + annual report",
      price: formatCents(o.bundleCents, { trimZeros: true }),
      unit: "a year + state fee",
      points: ["Registered agent included", "We file your annual report", `In ${o.bundleStateCount} states`],
      href: "/registered-agent",
      cta: "See the bundle",
      featured: true,
    });
  }
  if (o.reportFromCents !== undefined) {
    const points =
      o.providerReportCents !== undefined && o.providerReportCents !== o.reportFromCents
        ? ["Pay once per filing", `${formatCents(o.providerReportCents, { trimZeros: true })} in some states`, `In ${o.reportStateCount} states`]
        : ["Pay once per filing", "The state's confirmation, kept for you", `In ${o.reportStateCount} states`];
    plans.push({
      title: "Annual report",
      lead: "From",
      price: formatCents(o.reportFromCents, { trimZeros: true }),
      unit: "+ state fee",
      points,
      href: "/pricing#cost",
      cta: "See my state's price",
    });
  }
  if (o.formationCents !== undefined) {
    plans.push({
      title: "Start a business",
      price: formatCents(o.formationCents, { trimZeros: true }),
      unit: "+ state fee",
      points: ["LLC or corporation", "State fee at cost", inStates(o.formationStates, o.formationStates.length)],
      href: "/business-formation",
      cta: "See prices",
    });
  }
  return plans;
}

export function PlanCards({ offers, className = "" }: { offers: PlanOffers; className?: string }) {
  const plans = plansFrom(offers);
  if (plans.length === 0) return null;
  const cols = plans.length >= 4 ? "lg:grid-cols-4" : plans.length === 3 ? "lg:grid-cols-3" : "";
  return (
    <ul className={`grid gap-4 sm:grid-cols-2 ${cols} ${className}`} aria-label="Our services">
      {plans.map((p) => (
        <li key={p.title} className="grid">
          <div
            className={`relative grid content-start gap-5 rounded-[var(--radius-surface)] border p-6 ${
              p.featured ? "border-ink bg-ink text-ink-fg shadow-lift" : "border-border bg-surface text-fg shadow-card"
            }`}
          >
            {p.featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-highlight px-3 py-1 text-xs font-bold uppercase tracking-wider text-highlight-fg">
                Best value
              </span>
            ) : null}
            <h3 className="text-[17px] font-semibold">{p.title}</h3>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              {p.lead ? <span className={`text-sm ${p.featured ? "text-ink-muted" : "text-muted"}`}>{p.lead}</span> : null}
              <span className="tnum font-display text-[44px] font-semibold leading-none tracking-tight">{p.price}</span>
              <span className={`text-sm ${p.featured ? "text-ink-muted" : "text-muted"}`}>{p.unit}</span>
            </p>
            <ul className="grid gap-2.5">
              {p.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-[15px] leading-6">
                  <span
                    aria-hidden
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${p.featured ? "bg-highlight text-highlight-fg" : "bg-accent-soft text-accent"}`}
                  >
                    <Check size={12} weight="bold" />
                  </span>
                  {pt}
                </li>
              ))}
            </ul>
            <Link href={p.href} className={buttonClasses(p.featured ? "inverse" : "secondary", "md", "mt-1 w-full")}>
              {p.cta}
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
