"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateProfileAction, type ProfileState, type ProfileValues } from "./actions";

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfileAction, undefined);
  const values = state?.values ?? initial;
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state?.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      {state?.ok ? (
        <Notice tone="success" role="status" key={state.savedAt}>
          Your profile was saved.
        </Notice>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" optional error={errors.fullName} className="content-start">
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            maxLength={200}
            defaultValue={values.fullName}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? "fullName-error" : undefined}
          />
        </Field>
        <Field
          label="Phone"
          htmlFor="phone"
          optional
          className="content-start"
          hint="Only used if we need to reach you about a filing."
          error={errors.phone}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            maxLength={40}
            defaultValue={values.phone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
          />
        </Field>
      </div>
      <div className="flex justify-end border-t border-border pt-5">
        <SubmitButton className="w-full sm:w-auto" pendingLabel="Saving…">
          Save profile
        </SubmitButton>
      </div>
    </form>
  );
}
