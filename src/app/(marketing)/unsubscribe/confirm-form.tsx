"use client";

import { BellSlash, CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { confirmUnsubscribeAction, type UnsubscribeState } from "./actions";

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, action] = useActionState<UnsubscribeState, FormData>(confirmUnsubscribeAction, undefined);

  if (state?.status === "done") {
    return (
      <div className="grid gap-5" role="status">
        <span aria-hidden className="grid size-12 place-content-center rounded-full bg-accent-soft text-accent-soft-fg">
          <CheckCircle size={26} weight="fill" />
        </span>
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Deadline reminders are off</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            We won&apos;t email you about upcoming filing deadlines anymore. Emails about filings you&apos;ve paid for,
            such as order confirmations and status updates, will still arrive.
          </p>
          <p className="text-[15px] leading-relaxed text-muted">
            Changed your mind? You can turn reminders back on at any time in your account settings.
          </p>
        </div>
        <div>
          <Link href="/dashboard/settings#email-preferences" className={buttonClasses("secondary", "lg")}>
            Go to settings
          </Link>
        </div>
      </div>
    );
  }

  if (state?.status === "invalid") {
    return <InvalidLink />;
  }

  return (
    <div className="grid gap-5">
      <span aria-hidden className="grid size-12 place-content-center rounded-full bg-surface-2 text-muted">
        <BellSlash size={24} />
      </span>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Stop deadline reminders?</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          We&apos;ll stop emailing you reminders before your businesses&apos; filing deadlines. Emails about filings
          you&apos;ve paid for, such as order confirmations and status updates, are always sent.
        </p>
      </div>
      {state?.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="hidden" name="token" value={token} />
        <SubmitButton size="lg" pendingLabel="Updating…">
          Stop reminders
        </SubmitButton>
        <Link href="/" className={buttonClasses("ghost", "lg")}>
          Keep reminders
        </Link>
      </form>
    </div>
  );
}

export function InvalidLink() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">This link isn&apos;t working</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          The unsubscribe link may have expired or been cut off by your email app. Sign in to manage your email
          preferences, including deadline reminders.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/login?next=${encodeURIComponent("/dashboard/settings")}`} className={buttonClasses("primary", "lg")}>
          Sign in to manage emails
        </Link>
      </div>
    </div>
  );
}
