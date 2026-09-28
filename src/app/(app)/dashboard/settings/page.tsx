import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, Container, PageHeader } from "@/components/ui/surface";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/ui/table";
import { formatTimestamp, NOTIFICATION_STATUS_LABELS } from "@/components/dashboard/format";
import { backLinkClass, DashboardSection, quietLinkClass } from "@/components/dashboard/section";
import { loadSettings } from "../_lib/data";
import { ProfileForm } from "./profile-form";
import { ReminderForm } from "./reminder-form";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const STATUS_TONES: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  sent: "success",
  queued: "neutral",
  failed: "warning",
  suppressed: "neutral",
};

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const { profile, notifications } = await loadSettings(user.id);

  return (
    <Container className="py-8 sm:py-12">
      <div className="grid max-w-3xl gap-10">
        <div className="grid gap-4">
          <Link href="/dashboard" className={backLinkClass}>
            <ArrowLeft size={16} aria-hidden />
            Dashboard
          </Link>
          <PageHeader title="Settings" description="Your account, profile and email preferences." />
        </div>

        <DashboardSection id="account" title="Account">
          <Card className="p-5 sm:p-6">
            <dl className="grid gap-6">
              <div className="grid gap-1 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-x-6">
                <dt className="text-sm text-muted">Email</dt>
                <dd className="grid gap-1">
                  <span className="break-all text-[15px] text-fg">{user.email || profile?.email || "Not available"}</span>
                  <span className="text-sm text-subtle">You sign in with this address, and it&apos;s where we send email.</span>
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[minmax(8rem,12rem)_1fr] sm:gap-x-6">
                <dt className="text-sm text-muted">Password</dt>
                <dd>
                  <Link href="/forgot-password" className={`${quietLinkClass} text-[15px]`}>
                    Change your password
                  </Link>
                  <p className="mt-1 text-sm text-subtle">We&apos;ll email you a secure link to set a new one.</p>
                </dd>
              </div>
            </dl>
          </Card>
        </DashboardSection>

        <DashboardSection id="profile" title="Profile">
          <Card className="p-5 sm:p-6">
            <ProfileForm initial={{ fullName: profile?.fullName ?? "", phone: profile?.phone ?? "" }} />
          </Card>
        </DashboardSection>

        <DashboardSection id="email-preferences" title="Email preferences">
          <Card className="grid gap-5 p-5 sm:p-6">
            <ReminderForm enabled={profile?.reminderEmailsEnabled ?? true} />
            <p className="border-t border-border pt-4 text-sm text-muted">
              Emails about filings you&apos;ve paid for, such as your order confirmation, status updates, requests for
              information and your receipt, are always sent so you never miss something about an order.
            </p>
          </Card>
        </DashboardSection>

        <DashboardSection
          id="email-history"
          title="Email history"
          description="The most recent emails we've sent you, newest first."
        >
          {notifications.length > 0 ? (
            <TableScroll>
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Subject</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {notifications.map((n) => (
                    <TR key={n.id}>
                      <TD className="whitespace-nowrap text-muted">
                        <time dateTime={n.sentAt ?? n.createdAt} className="tnum">
                          {formatTimestamp(n.sentAt ?? n.createdAt)}
                        </time>
                      </TD>
                      <TD className="min-w-[14rem]">{n.subject}</TD>
                      <TD>
                        <Badge tone={STATUS_TONES[n.status] ?? "neutral"}>{NOTIFICATION_STATUS_LABELS[n.status] ?? n.status}</Badge>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          ) : (
            <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong px-4 py-6 text-sm text-muted">
              No emails yet. Reminders and filing updates will be listed here.
            </p>
          )}
        </DashboardSection>
      </div>
    </Container>
  );
}
