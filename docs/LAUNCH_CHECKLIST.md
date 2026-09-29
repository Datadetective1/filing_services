# Launch checklist

Items that need an owner decision or action before real customers and real money.

## Business and legal

- [ ] Final product name and legal entity (currently the working name "Filewell";
      `site.legalEntity` is a placeholder). Update `src/config/site.ts`.
- [ ] Domain purchased and connected (production indexing is off until
      `NEXT_PUBLIC_ALLOW_INDEXING=true` on the production deployment).
- [ ] Attorney review of `/legal/terms`, `/legal/privacy`, `/legal/refunds`,
      `/legal/filing-authorization`, `/legal/disclaimer` (all marked as drafts).
- [ ] Counsel confirms the e-signature wording operators use on Pennsylvania reports
      (packet: "<Company> by <operator>, Authorized Representative").
- [ ] Decide and approve the Pennsylvania service fee in `/admin/pricing`
      (seeded provisional value: $49, **not approved**; live checkout refuses it until approved).

## Payments (Stripe)

- [ ] Create a Stripe account/sandbox **for this business** (do not reuse another product's).
      Describe the business accurately: private filing-preparation service, not a government
      agency. Suggested MCC: 7399 (business services) or 8999 (professional services); avoid
      government MCCs (9399 etc. are restricted).
- [ ] Complete Stripe identity/business verification.
- [ ] Set `STRIPE_SECRET_KEY` (test first), `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_PROVIDER=stripe`.
      Register the webhook `https://<domain>/api/webhooks/payments/stripe`.
- [ ] Run a Stripe **test-mode** purchase end to end, including a refund.
- [ ] Only then: live keys + `PAYMENTS_LIVE_ENABLED=true`.

## Email

- [ ] Verify a sending domain for this product in Resend (SPF/DKIM/DMARC).
- [ ] Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` (e.g.
      `Filewell <filings@yourdomain>`), `EMAIL_REPLY_TO`.
- [ ] Configure Supabase Auth SMTP to use the same domain (Supabase's default mailer is
      rate-limited and not meant for production).

## Infrastructure

- [ ] Supabase production project (separate from staging), migrations applied, `npm run seed`.
- [ ] Supabase Auth: Site URL + redirect URLs set to the production domain
      (`/auth/confirm`), email confirmations on, password policy (10+ chars, mixed case, digit).
- [ ] Vercel production env vars (see `.env.example`), `CRON_SECRET` set (cron uses it).
- [ ] Vercel plan allows commercial use (Hobby does not).
- [ ] First admin granted: `npm run grant-staff -- you@company.com admin`.

## Operations

- [ ] Company Business Filing Services (file.dos.pa.gov) login created (Keystone Login).
- [ ] Company card for state fees.
- [ ] Support mailbox monitored; `site.supportEmail` updated.
