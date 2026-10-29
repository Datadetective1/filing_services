import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { SERVICES } from "@/lib/services/catalog";
import { listServices } from "@/lib/services/customer-view";
import { DashboardSection, QuietEmpty, quietLinkClass } from "@/components/dashboard/section";
import { Badge } from "@/components/ui/badge";

/**
 * Registered agent service for one business, on the business page. Hidden on production
 * until business services launch (BUSINESS_SERVICES_PAGES), unless the customer already has
 * a service to manage.
 */
export async function BusinessServicesSection({ userId, businessId }: { userId: string; businessId: string }) {
  const services = await listServices(userId, businessId);
  const canOrder = businessServicesPagesEnabled();
  if (services.length === 0 && !canOrder) return null;
  return (
    <DashboardSection
      id="registered-agent"
      title="Registered agent"
      action={
        canOrder && !services.some((s) => s.serviceStatus !== "ended") ? (
          <Link href={`/dashboard/services/new?business=${businessId}`} className={quietLinkClass}>
            Add registered agent service
          </Link>
        ) : null
      }
    >
      {services.length === 0 ? (
        <QuietEmpty>We aren&apos;t this business&apos;s registered agent.</QuietEmpty>
      ) : (
        <ul className="grid gap-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/services/${s.id}`} className="group flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 hover:border-border-strong">
                <span className="grid gap-1">
                  <span className="font-semibold text-fg group-hover:text-accent">
                    {SERVICES[s.plan].name} in {s.stateName}
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Badge tone={s.serviceStatus === "active" ? "success" : s.serviceStatus === "ended" ? "neutral" : "info"}>
                      {s.serviceStatus === "active" ? "Active" : s.serviceStatus === "ended" ? "Ended" : s.serviceStatus === "pending_appointment" ? "Being set up" : "Ending"}
                    </Badge>
                    {s.billingStatus === "past_due" || s.billingStatus === "unpaid" ? <Badge tone="danger">Payment failed</Badge> : null}
                  </span>
                </span>
                <CaretRight size={18} weight="bold" className="shrink-0 text-subtle group-hover:text-accent" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
