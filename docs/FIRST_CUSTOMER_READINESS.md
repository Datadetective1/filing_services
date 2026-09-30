# First-customer readiness: Filewell, Pennsylvania

Re-audited 2026-09-30 against the live production configuration (Vercel env names and
targets, Supabase auth settings, DNS, production database, live site). Canonical site:
https://www.getfilewell.com. Detailed checklist: [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).
Runbooks: [OPERATIONS.md](OPERATIONS.md).

## 1. Launch verdict

**CAN FILEWELL ACCEPT ITS FIRST REAL CUSTOMER? NO, not yet.** Infrastructure, DNS, owner
auth and production email are verified end to end. What remains: the legal operator
identity and draft-terms decision, Pennsylvania filing access, fee approval, Stripe live
payments, and one real order you place yourself. The full customer-to-operator workflow is
validated on staging and a Vercel preview.

**Ready to proceed to Stripe setup: yes.** Production database, auth, email and domain are
all verified (owner checks in 4.1 passed 2026-09-30). Payments and indexing remain off.

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
- Production database: reference data plus the owner's own records only (1 user, 1 admin,
  1 business, 1 draft filing, 1 notification); 0 orders, 0 payments. No staging or test
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

**Owner auth: PASS (owner-verified 2026-09-30).** On www, with a real address: sign-up,
the confirmation email (via Supabase custom SMTP through Resend), sign-in, and password
reset all worked. The owner was granted admin with the first-admin SQL in OPERATIONS.md
(1 active staff member, role `admin`; `staff.granted` audit row).

**Production app email: PASS (2026-09-30).** The owner clicked "Send test email to me" on
`/admin/notifications` (staff-only; same `sendNotification` path, renderer and Resend
provider as customer emails; no filing, order or payment involved).
- Database (engineer-verified): notification `staff_email_test`, status `sent`, provider
  `resend`, with a Resend message id (Resend accepted it); one `email.test_sent` audit row;
  orders 0, payments 0, and the one draft filing unchanged (status `draft`, not updated
  since it was created before the send).
- Outlook (owner-verified): arrived from `Filewell <filings@getfilewell.com>` with subject
  "Filewell production email test"; Reply-To was `support@getfilewell.com`; the reply was
  routed back to the owner's Outlook inbox through Cloudflare Email Routing.

## 3. Remaining launch blockers

1. Legal: the operator's name and postal address (shown publicly and in email footers),
   your recorded decision to sell under the draft terms, counsel's OK on the
   authorized-representative e-signature wording.
2. Pennsylvania filing access: a file.dos.pa.gov login and a company card for the $7 fee.
3. Stripe live payments: account, keys, webhook, final fee approval, then your switch-on.

## 4. Remaining human actions, in order

**4.1 Done (2026-09-30).** DMARC de-duplicated, root SPF includes Cloudflare, owner sign-up
/ confirmation / sign-in / reset, first admin granted, admin status panel checked, and a
production email delivered, replied to and routed back (section 2).

**4.2 Legal values (2 min, once decided).** Vercel → Environment Variables → Add
`NEXT_PUBLIC_LEGAL_ENTITY` and `NEXT_PUBLIC_POSTAL_ADDRESS` (Production only) → Redeploy.
Record your decision about the draft terms.

**4.3 Pennsylvania access.** Create the file.dos.pa.gov Business Filing Services login and
have the company card ready.

**4.4 Stripe, then live.** As in OPERATIONS.md, "Stripe production setup": activate the
Filewell Stripe account; public details (Filewell, support@getfilewell.com, descriptor
`FILEWELL`); cards only; webhook `https://www.getfilewell.com/api/webhooks/payments/stripe`
with `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`,
`refund.updated`. In Vercel, **Production only**: `STRIPE_SECRET_KEY` (sk_live, Sensitive),
`STRIPE_WEBHOOK_SECRET` (Sensitive), and split `PAYMENTS_PROVIDER` so Production is `stripe`
while Preview/Development stay `sandbox` (edit the existing variable to untick Production,
then add a Production-only one). Approve the fee at `/admin/pricing`. When ready to take
money: Production `PAYMENTS_LIVE_ENABLED=true` (split the same way) → Redeploy.

**4.5 One real order** placed by you and filed with the runbook below. Then the verdict is
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

**Launch blockers** (section 3): legal operator name/address and the draft-terms
decision, PA filing login and card, live Stripe + fee approval.

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
