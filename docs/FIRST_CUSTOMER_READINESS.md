# First-customer readiness: Filewell, Pennsylvania

Re-audited 2026-09-30 against the live production configuration (Vercel env names and
targets, Supabase auth settings, DNS, production database, live site). Canonical site:
https://www.getfilewell.com. Detailed checklist: [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).
Runbooks: [OPERATIONS.md](OPERATIONS.md).

## 1. Launch verdict

**CAN FILEWELL ACCEPT ITS FIRST REAL CUSTOMER? NO, not yet.** Infrastructure is now in
place and verified. What remains: two DNS corrections, your own account and email check,
Stripe live payments with an approved fee, the legal entity/address and draft-terms
decision, and Pennsylvania filing access. The full customer-to-operator workflow is
validated on staging and a Vercel preview; the last proof on production is one real order
you place yourself.

**Ready to proceed to Stripe setup: yes** (production database, auth, email and domain are
correct). Switching live payments on should wait until the owner checks in 4.3 to 4.5 pass.

## 2. Re-audit findings (2026-09-30)

**Fixed during the re-audit**

1. **Production was using staging keys against the production database.** The app reads
   `SUPABASE_SECRET_KEY` before `SUPABASE_SERVICE_ROLE_KEY`, and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` before `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The staging
   values of the preferred names were still on the Production target, so the new production
   keys were ignored: Supabase rejected the public key (`401 Invalid API key`), and server
   writes failed silently (a page view's analytics row reached neither database). Sign-up,
   sign-in and every database action on www were broken in the live deployment.
   Fix (env targets only; no secret value read, rotated or deleted): `SUPABASE_SECRET_KEY`
   (staging) scoped to Preview; the staging publishable key scoped to Preview and
   Development; a Production-only `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the production
   key; production redeployed. Verified: a page view now writes to `filewell-production`,
   and the site's security policy references only the production project.
2. **Preview and Development pointed at the production database.** `NEXT_PUBLIC_SUPABASE_URL`
   (production) applied to all targets, so previews and E2E runs could have written test data
   into production. It is now Production-only, with a Preview/Development variable pointing
   at staging.
3. **Supabase SMTP port was 572** (Resend accepts 25, 465, 587, 2465, 2587), so every
   sign-up and password-reset email would have failed. Corrected to 587 (password
   untouched). No sign-ups had been attempted yet.
4. **New safeguard:** the admin status panel now shows "Database keys: Both keys accepted"
   (a live check of each key), so a key from the wrong project is visible at a glance.

**Verified correct**

- Vercel Production: `NEXT_PUBLIC_SUPABASE_URL` = filewell-production, production
  publishable key, `SUPABASE_SERVICE_ROLE_KEY` (production), `EMAIL_PROVIDER=resend`,
  `RESEND_API_KEY` (Production only), `EMAIL_FROM=Filewell <filings@getfilewell.com>`,
  `EMAIL_REPLY_TO=support@getfilewell.com`, `NEXT_PUBLIC_SITE_URL=https://www.getfilewell.com`,
  `PAYMENTS_PROVIDER=sandbox` + `PAYMENTS_LIVE_ENABLED=false` (production refuses the sandbox,
  so checkout is safely closed), `NEXT_PUBLIC_ALLOW_INDEXING=false`. None of the
  `ALLOW_*_IN_PRODUCTION` overrides exist. Vercel is on Pro.
- Production database: 0 users, 0 orders, 0 staff; reference data only. No staging or test
  records.
- Supabase auth (production): Site URL `https://www.getfilewell.com`, redirects for www and
  apex only, email confirmation required, password policy and leaked-password check on,
  custom SMTP via Resend (sender support@getfilewell.com), 30 emails/hour.
- Live site: 25/25 read-only production checks, 14/14 public smoke tests (desktop + mobile),
  a no-account lookup at desktop and mobile ($7 state fee shown, unapproved $49 hidden,
  "File it yourself" links to file.dos.pa.gov), auth pages noindex, invalid or expired
  confirmation links land on a clear login message, open-redirect probe refused, sandbox
  checkout 404, sandbox webhook 503, admin requires sign-in.
- DNS: DKIM `resend._domainkey` present; Resend SPF and bounce MX on `send.getfilewell.com`;
  Cloudflare Email Routing MX on getfilewell.com; Cloudflare DKIM key present.

**DNS (re-verified externally 2026-09-30 via 1.1.1.1 and 8.8.8.8): PASS.** One DMARC
record (`v=DMARC1; p=none; rua=...@dmarc-reports.cloudflare.net`); root SPF
`v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com -all` (2 DNS lookups); Resend
SPF and bounce MX on `send.getfilewell.com`; DKIM `resend._domainkey`; Cloudflare Email
Routing MX. Amazon SES is not used anywhere (no code, dependency or env var; Resend sends
with its own return path on `send.`), so `include:amazonses.com` can be removed later for a
tighter SPF; it is harmless.

**Not verifiable by the engineer** (safety rules forbid creating accounts or entering
passwords on the live site, and your Resend account for getfilewell.com is not connected to
the engineer's tools): a real sign-up, confirmation email, sign-in, password reset, and a
real Resend delivery from the production key. Steps 4.3 to 4.5 cover them.

## 3. Remaining launch blockers

2. Your production account: sign up, confirm, grant yourself admin, and prove auth and
   Resend delivery end to end.
3. Stripe live payments: account, keys, webhook, final fee approval, then your switch-on.
4. Legal: operating company name and postal address (shown publicly and in email footers),
   your recorded decision to sell under the draft terms, counsel's OK on the
   authorized-representative e-signature wording.
5. Pennsylvania filing access: a file.dos.pa.gov login and a company card for the $7 fee.

## 4. Remaining human actions, in order

**4.1 Fix DMARC (2 min).** Cloudflare → getfilewell.com → DNS → Records → filter TXT
`_dmarc` → delete the record whose content is exactly `v=DMARC1; p=none;` → keep the one
with `rua=mailto:...@dmarc-reports.cloudflare.net`.

**4.2 Fix the root SPF (2 min).** Cloudflare → Email → Email Routing → Settings (it lists
any missing records). Then DNS → the TXT record on `getfilewell.com` starting `v=spf1` →
Edit → content `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all` → Save.
(Exactly one SPF record; keeping `include:amazonses.com` is harmless.)

**4.3 Sign up and test auth (10 min).** In a normal browser window:
1. https://www.getfilewell.com/signup with your real address → "Check your email".
2. Open the "Confirm your Filewell account" email **in the same browser** → you land signed
   in on the dashboard. (Gmail → ⋮ → Show original: SPF, DKIM and DMARC = PASS.)
3. Sign out → sign in again.
4. Sign out → https://www.getfilewell.com/forgot-password → open "Reset your Filewell
   password" in the same browser → set a new password → you land on the dashboard.

**4.4 Make yourself admin and check the panel (3 min).** Supabase → filewell-production →
SQL Editor → run the "No-laptop alternative" in OPERATIONS.md, "First admin" (replace the
email). Open https://www.getfilewell.com/admin: the status panel must show Database
**Production (tnwpcprvetxtgyjuncrl)**, Database keys **Both keys accepted**, Customer email
**Delivering (Resend)**, Payments **disabled**, Search indexing **Off**.

**4.5 Prove app email through Resend, no payment (5 min).** On www: Find my business → PA →
your real entity → Have us file it → Continue to details (this creates a draft filing;
nothing is charged). Open the filing in your dashboard and send a message ("test"). You
should receive a "Customer message" staff alert from `filings@getfilewell.com` (Reply-To
support@getfilewell.com); `/admin/notifications` shows provider `resend`, status `sent`.
Reply to it once to confirm the reply reaches you through Cloudflare forwarding.

**4.6 Legal values (2 min, once decided).** Vercel → Environment Variables → Add
`NEXT_PUBLIC_LEGAL_ENTITY` and `NEXT_PUBLIC_POSTAL_ADDRESS` (Production only) → Redeploy.
Record your decision about the draft terms.

**4.7 Pennsylvania access.** Create the file.dos.pa.gov Business Filing Services login and
have the company card ready.

**4.8 Stripe, then live.** As in OPERATIONS.md, "Stripe production setup": activate the
Filewell Stripe account; public details (Filewell, support@getfilewell.com, descriptor
`FILEWELL`); cards only; webhook `https://www.getfilewell.com/api/webhooks/payments/stripe`
with `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`,
`refund.updated`. In Vercel, **Production only**: `STRIPE_SECRET_KEY` (sk_live, Sensitive),
`STRIPE_WEBHOOK_SECRET` (Sensitive), and split `PAYMENTS_PROVIDER` so Production is `stripe`
while Preview/Development stay `sandbox` (edit the existing variable to untick Production,
then add a Production-only one). Approve the fee at `/admin/pricing`. When ready to take
money: Production `PAYMENTS_LIVE_ENABLED=true` (split the same way) → Redeploy.

**4.9 One real order** placed by you and filed with the runbook below. Then the verdict is
YES.

**Optional clean-up (not blocking):** remove the Production target from
`SANDBOX_WEBHOOK_SECRET` (unused there); `NEXT_PUBLIC_SUPABASE_ANON_KEY` is now unused
(harmless); give Production its own `APP_SIGNING_SECRET`, `IP_HASH_SALT` and `CRON_SECRET`
(they are shared with Preview).

## 5. First real customer runbook

1. **An order arrives.** You get a "New paid order" email (staff alert). Open
   https://www.getfilewell.com/admin: the order is at the top of "Your next step for each
   paid customer". It must **not** carry a TEST badge.
2. **Open the filing.** Check the header: Payment `Paid`, Authorization recorded (the
   Actions card says "The details and authorization check out"), no customer message
   asking to cancel. In Stripe, check there is no dispute or fraud warning.
3. **Review** the Answers section (legal name, entity number, registered office or CROP +
   county, principal office, governors, officers). If something is missing, use
   **Request customer information** (the customer is emailed; the filing waits). Otherwise
   click **Mark ready to file**.
4. **Open filing packet** and keep it beside the state site. Click **Start filing**, then
   **Open official filing site**: file.dos.pa.gov → Business Search → the entity → **File
   Annual Report** → enter each value exactly as the packet shows → declarations → e-sign
   with the packet's signature wording → pay the $7 with the company card.
5. PA approves online reports automatically, usually within minutes. **Download the filed
   report and the acknowledgement letter right away** (the state keeps them 60 days).
6. Back in the filing: **Mark submitted** with the confirmation number (the customer gets
   the "submitted" email).
7. **Upload** the filed report and acknowledgement (Document type *Filed report* /
   *Acknowledgement letter*, visible to customer). The customer gets a "document ready" email.
8. **Mark accepted.** With the documents on file the filing completes: the customer gets
   the "accepted" email, this year's reminders stop and next year's requirement and
   reminders are created automatically.
9. Check **Emails** (`/admin/notifications`): each message should show provider `resend`,
   status `sent`.

Problems (rejection, cancellation, refunds) are in OPERATIONS.md, "Problems".

## 6. Rollback

- **Stop taking payments:** Vercel → Production `PAYMENTS_LIVE_ENABLED` = `false` →
  Redeploy. Checkout then shows "payments aren't open yet". Stripe webhooks get 503 and are
  retried for up to 3 days; refund in the Stripe dashboard meanwhile.
- **Stop sending email:** Production `EMAIL_PROVIDER` = `outbox` → Redeploy. Emails are
  still recorded in `/admin/notifications`.
- **Revert the site:** Vercel → Deployments → pick the previous good Production deployment
  → ⋯ → **Promote to Production** (instant). Or `git revert -m 1 06d7581` and push.
- **Database:** every migration is backward compatible; nothing needs to be rolled back to
  run an older deployment. To undo only `20260929000007` (column grants), run in the SQL
  editor: `grant select on public.service_prices, public.state_rule_versions to anon;`
  and recreate the old `service_prices_read` policy from `20260927000003_rls.sql`.
- **Supabase keys:** production reads `NEXT_PUBLIC_SUPABASE_URL`, the Production-only
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (because
  `SUPABASE_SECRET_KEY` is Preview-only). Never put a staging value on the Production target
  of either preferred name; check "Database keys" on /admin after any change.

## 7. Known risks

**Launch blockers** (section 3): DNS (DMARC duplicate, root SPF), owner account and
end-to-end auth/email proof, live Stripe + fee approval, legal entity/address and the
draft-terms decision, PA filing login and card.

**Can fix after the first customer**

- Production and Preview share `APP_SIGNING_SECRET`, `IP_HASH_SALT` and `CRON_SECRET`;
  give Production its own values (needs someone who can handle secrets).
- Customers can edit their own intake answers directly through the database API while a
  filing is editable (their own filing only); the ready-to-file hash check catches it.
  Tightening to server-only writes is a small follow-up.
- Direct database inserts can bypass the app's message rate limit (own filings only).
- Sign-in, sign-up and reset throttles are per IP only.
- An email confirmation link opened in a different browser confirms the address but asks
  the customer to sign in (clear message; by design of PKCE).
- Branded Supabase auth email bodies (defaults work; subjects are branded).
- Email CTA buttons use a dark neutral color rather than the brand green.
- Stuck-payment cases (money moved, order didn't advance) are listed on /admin/payments
  but not emailed to staff.
- Two admins refunding the same order at the same moment could over-refund (single
  operator today).

**Future enhancements**

- Before Jan 1, 2027: confirm whether Pennsylvania accepts a 2026 report after Dec 31,
  and decide how unfiled 2026 reports roll into 2027.
- Sales-tax determination for the service fee.
- Error monitoring/alerting (Sentry or similar) and a record of each reminder cron run.
- Turning on search indexing (only with your written approval; procedure in OPERATIONS.md).
