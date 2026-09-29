import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, EnvelopeSimple, Key } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { formatTimestamp, NOTIFICATION_STATUS_LABELS } from "@/components/dashboard/format";
import { backLinkClass, DashboardSection, QuietEmpty } from "@/components/dashboard/section";
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

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "profile", label: "Profile" },
  { id: "email-preferences", label: "Email preferences" },
  { id: "email-history", label: "Email history" },
] as const;

const panel = "rounded-[var(--radius-surface)] border border-border bg-surface";

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  const { profile, notifications } = await loadSettings(user.id);

  return (
    <Container className="py-8 sm:py-12">
      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Link href="/dashboard" className={backLinkClass}>
            <ArrowLeft size={16} weight="bold" aria-hidden className="transition-transform group-hover:-translate-x-0.5" />
            Dashboard
          </Link>
          <h1 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-fg sm:text-[40px]">Settings</h1>
          <p className="mt-1.5 max-w-[40ch] text-[15px] leading-6 text-muted">Your account, profile and email preferences.</p>
          <nav aria-label="Settings sections" className="mt-8 max-lg:hidden">
            <ul className="-ml-3.5 grid gap-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex min-h-10 items-center rounded-full px-3.5 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="grid max-w-2xl gap-14">
          <DashboardSection id="account" title="Account">
            <div className={`${panel} divide-y divide-border`}>
              <div className="flex items-start gap-4 p-5 sm:p-6">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent max-sm:hidden">
                  <EnvelopeSimple size={18} weight="fill" />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <p className="text-[13px] font-medium text-muted">Email</p>
                  <p className="break-words text-[15px] font-semibold text-fg">{user.email || profile?.email || "Not available"}</p>
                  <p className="text-sm leading-6 text-muted">You sign in with this address, and it&apos;s where we send email.</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-4">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg max-sm:hidden">
                    <Key size={18} weight="fill" />
                  </span>
                  <div className="grid gap-0.5">
                    <p className="text-[13px] font-medium text-muted">Password</p>
                    <p className="text-sm leading-6 text-muted">We&apos;ll email you a secure link to set a new one.</p>
                  </div>
                </div>
                <Link href="/forgot-password" className={buttonClasses("secondary", "sm", "min-h-11 shrink-0 sm:min-h-10")}>
                  Change your password
                </Link>
              </div>
            </div>
          </DashboardSection>

          <DashboardSection id="profile" title="Profile">
            <div className={`${panel} p-5 sm:p-6`}>
              <ProfileForm initial={{ fullName: profile?.fullName ?? "", phone: profile?.phone ?? "" }} />
            </div>
          </DashboardSection>

          <DashboardSection id="email-preferences" title="Email preferences">
            <div className={`${panel} divide-y divide-border`}>
              <div className="p-5 sm:p-6">
                <ReminderForm enabled={profile?.reminderEmailsEnabled ?? true} />
              </div>
              <p className="bg-surface-2/50 px-5 py-4 text-sm leading-6 text-muted sm:px-6">
                Emails about filings you&apos;ve paid for, such as your order confirmation, status updates, requests for
                information and your receipt, are always sent so you never miss something about an order.
              </p>
            </div>
          </DashboardSection>

          <DashboardSection
            id="email-history"
            title="Email history"
            description="The most recent emails we've sent you, newest first."
          >
            {notifications.length > 0 ? (
              <ul className={`${panel} divide-y divide-border overflow-hidden`}>
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4 sm:px-5">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
                      >
                        <EnvelopeSimple size={16} weight="fill" />
                      </span>
                      <div className="grid min-w-0 gap-0.5">
                        <p className="break-words text-[15px] leading-snug text-fg">{n.subject}</p>
                        <p className="tnum text-[13px] text-subtle">
                          <time dateTime={n.sentAt ?? n.createdAt}>{formatTimestamp(n.sentAt ?? n.createdAt)}</time>
                        </p>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONES[n.status] ?? "neutral"} className="ml-12 sm:ml-0">
                      {NOTIFICATION_STATUS_LABELS[n.status] ?? n.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <QuietEmpty>No emails yet. Reminders and filing updates will be listed here.</QuietEmpty>
            )}
          </DashboardSection>
        </div>
      </div>
    </Container>
  );
}
