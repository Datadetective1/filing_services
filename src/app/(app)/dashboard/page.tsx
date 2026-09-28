import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Plus } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, PageHeader } from "@/components/ui/surface";
import { BusinessRow } from "@/components/dashboard/business-row";
import { formatTimestampDate } from "@/components/dashboard/format";
import { DashboardNotices } from "@/components/dashboard/notices";
import { DashboardSection, quietLinkClass } from "@/components/dashboard/section";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { loadDashboard } from "./_lib/data";

export const metadata: Metadata = {
  title: "Your businesses",
  robots: { index: false, follow: false },
};

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const [searchParams, data] = await Promise.all([props.searchParams, loadDashboard(user.id)]);
  const { businesses, openRequirements, filings, notifications } = data;
  const businessMap = new Map(businesses.map((b) => [b.id, b]));
  const upcoming = openRequirements.filter((r) => r.daysRemaining <= 365);

  return (
    <Container className="grid gap-10 py-8 sm:py-12">
      <PageHeader
        title="Your businesses"
        description="Deadlines, filings and updates for the businesses you track."
        actions={
          businesses.length > 0 ? (
            <ButtonLink href="/find" variant="secondary" className="min-h-11">
              <Plus size={16} weight="bold" aria-hidden />
              Add a business
            </ButtonLink>
          ) : null
        }
      />

      <DashboardNotices searchParams={searchParams} />

      {businesses.length === 0 ? (
        <EmptyState
          title="Add your first business"
          body="Look up your business to see which filings it needs and when they're due. We'll remind you before each deadline."
          action={
            <ButtonLink href="/find" size="lg">
              <Plus size={18} weight="bold" aria-hidden />
              Add your first business
            </ButtonLink>
          }
        />
      ) : (
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
      )}

      {businesses.length > 0 ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-12">
          <DashboardSection
            id="upcoming"
            title="Upcoming compliance events"
            description="Open filing deadlines across your businesses for the next 12 months."
          >
            {upcoming.length > 0 ? (
              <UpcomingEvents items={upcoming} businesses={businessMap} />
            ) : (
              <EmptyState
                title="Nothing due in the next 12 months"
                body="When a new filing period opens, it will show up here."
              />
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
              <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 p-4">
                    <Bell size={18} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
                    <div className="grid min-w-0 gap-0.5">
                      <p className="break-words text-[15px] text-fg">{n.subject}</p>
                      <p className="tnum text-sm text-subtle">
                        <time dateTime={n.sentAt ?? n.createdAt}>{formatTimestampDate(n.sentAt ?? n.createdAt)}</time>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong px-4 py-6 text-sm text-muted">
                No updates yet. We&apos;ll email you before deadlines and whenever a filing changes status.
              </p>
            )}
          </DashboardSection>
        </div>
      ) : null}
    </Container>
  );
}
