import type { Metadata } from "next";
import Link from "next/link";
import { EnvelopeSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { BusinessRow } from "@/components/dashboard/business-row";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { formatTimestampDate } from "@/components/dashboard/format";
import { NextActionPanel } from "@/components/dashboard/next-action-panel";
import { DashboardNotices } from "@/components/dashboard/notices";
import { rankFocus } from "@/components/dashboard/requirement-state";
import { DashboardSection, QuietEmpty, quietLinkClass } from "@/components/dashboard/section";
import { SupportCard } from "@/components/dashboard/support-card";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { loadDashboard } from "./_lib/data";

export const metadata: Metadata = {
  title: "Your businesses",
  robots: { index: false, follow: false },
};

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const [searchParams, data] = await Promise.all([props.searchParams, loadDashboard(user.id)]);
  const { businesses, openRequirements, filings, notifications } = data;

  if (businesses.length === 0) {
    return (
      <Container className="grid gap-8 py-10 sm:py-14 lg:py-20">
        <DashboardNotices searchParams={searchParams} />
        <EmptyDashboard />
      </Container>
    );
  }

  const businessMap = new Map(businesses.map((b) => [b.id, b]));
  const upcoming = openRequirements.filter((r) => r.daysRemaining <= 365);
  const ranked = rankFocus(businesses, openRequirements);
  const needCount = (ranked.focus ? 1 : 0) + ranked.others.length;
  const states = [...new Set(businesses.map((b) => b.stateName))];
  const summary = `${businesses.length} ${businesses.length === 1 ? "business" : "businesses"} in ${joinNames(states)}`;

  return (
    <Container className="py-8 sm:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] text-fg sm:text-[40px]">Your businesses</h1>
          <p className="text-[15px] text-muted">
            {summary}
            <span aria-hidden className="mx-2 text-subtle">
              ·
            </span>
            {needCount > 0 ? (
              <span className="font-semibold text-fg">
                {needCount === 1 ? "1 thing needs you" : `${needCount} things need you`}
              </span>
            ) : (
              "Nothing needs you right now"
            )}
          </p>
        </div>
        <ButtonLink href="/find" variant="secondary" className="max-sm:hidden">
          <Plus size={16} weight="bold" aria-hidden />
          Add a business
        </ButtonLink>
      </header>

      <DashboardNotices searchParams={searchParams} className="mt-6" />

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-14">
        <div className="grid content-start gap-12">
          <NextActionPanel focus={ranked.focus} others={ranked.others} upcoming={ranked.upcoming} />

          <section id="businesses" aria-labelledby="businesses-title" className="grid scroll-mt-6 content-start gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 id="businesses-title" className="text-xl font-semibold text-fg sm:text-[22px]">
                All businesses
              </h2>
              <Link href="/find" className={`${quietLinkClass} text-sm sm:hidden`}>
                <Plus size={14} weight="bold" aria-hidden />
                Add a business
              </Link>
            </div>
            <div className="grid gap-4">
              {businesses.map((business) => (
                <BusinessRow
                  key={business.id}
                  business={business}
                  nextRequirement={openRequirements.find((r) => r.businessId === business.id) ?? null}
                  latestFiling={filings.find((f) => f.businessId === business.id) ?? null}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="grid content-start gap-10">
          <DashboardSection id="upcoming" title="Coming up" description="Open deadlines in the next 12 months.">
            {upcoming.length > 0 ? (
              <UpcomingEvents items={upcoming} businesses={businessMap} />
            ) : (
              <QuietEmpty>Nothing due in the next 12 months. When a new filing period opens, it will show up here.</QuietEmpty>
            )}
          </DashboardSection>

          <DashboardSection
            id="updates"
            title="Recent updates"
            action={
              notifications.length > 0 ? (
                <Link href="/dashboard/settings#email-history" className={quietLinkClass}>
                  Email history
                </Link>
              ) : null
            }
          >
            {notifications.length > 0 ? (
              <ul className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 border-b border-border p-4 last:border-b-0">
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
                    >
                      <EnvelopeSimple size={16} weight="fill" />
                    </span>
                    <div className="grid min-w-0 gap-0.5">
                      <p className="break-words text-[15px] leading-snug text-fg">{n.subject}</p>
                      <p className="tnum text-[13px] text-subtle">
                        <time dateTime={n.sentAt ?? n.createdAt}>{formatTimestampDate(n.sentAt ?? n.createdAt)}</time>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <QuietEmpty>No updates yet. We&apos;ll email you before deadlines and whenever a filing changes status.</QuietEmpty>
            )}
          </DashboardSection>

          <SupportCard />
        </div>
      </div>
    </Container>
  );
}
