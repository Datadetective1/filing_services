"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "./actions";

function err(state: AuthState, key: string) {
  return state?.fieldErrors?.[key];
}

function aria(state: AuthState, key: string) {
  const e = err(state, key);
  return e ? { "aria-invalid": true as const, "aria-describedby": `${key}-error` } : {};
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.error ? <Notice tone="danger" role="alert">{state.error}</Notice> : null}
      <Field label="Email" htmlFor="email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required {...aria(state, "email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required {...aria(state, "password")} />
      </Field>
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-muted underline-offset-4 hover:text-fg hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton size="lg" pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.error ? <Notice tone="danger" role="alert">{state.error}</Notice> : null}
      <Field label="Your name" htmlFor="fullName" optional error={err(state, "fullName")}>
        <Input id="fullName" name="fullName" autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required {...aria(state, "email")} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 10 characters with upper- and lowercase letters and a number."
        error={err(state, "password")}
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required {...aria(state, "password")} />
      </Field>
      <SubmitButton size="lg" pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-xs text-muted">
        By creating an account you agree to the <Link className="underline" href="/legal/terms">Terms</Link> and{" "}
        <Link className="underline" href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state?.message ? <Notice tone="success" role="status">{state.message}</Notice> : null}
      {state?.error ? <Notice tone="danger" role="alert">{state.error}</Notice> : null}
      <Field label="Email" htmlFor="email" error={err(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required {...aria(state, "email")} />
      </Field>
      <SubmitButton size="lg" pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="grid gap-4" noValidate>
      {state?.error ? <Notice tone="danger" role="alert">{state.error}</Notice> : null}
      <Field label="New password" htmlFor="password" hint="At least 10 characters with upper- and lowercase letters and a number." error={err(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required {...aria(state, "password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={err(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required {...aria(state, "confirm")} />
      </Field>
      <SubmitButton size="lg" pendingLabel="Saving…">Save new password</SubmitButton>
    </form>
  );
}
