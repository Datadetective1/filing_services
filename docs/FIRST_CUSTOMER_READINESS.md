# First-customer readiness: Filewell, Pennsylvania

Written 2026-09-29 (overnight launch sprint). Canonical site: https://www.getfilewell.com.
Detailed checklist: [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md). Runbooks:
[OPERATIONS.md](OPERATIONS.md).

## 1. Launch verdict

**CAN FILEWELL ACCEPT ITS FIRST REAL CUSTOMER? NO, not yet.**

The software is ready and deployed. What is missing is owner-only setup: the production
database secret, real payments, real email delivery, an inbound support mailbox, and three
legal decisions. The complete customer-to-operator workflow has been validated
end to end on staging and on a Vercel preview (sandbox payment, operator filing, receipt,
customer notification, next-year reminder). It **cannot** be validated on production until
live payments are switched on, because production (correctly) refuses test payments. So
the last step on the path to YES is one real order, placed by you.

Today, production is safe: nobody can be charged, sandbox "payments" are refused, the
unapproved $49 fee is hidden, and search indexing is off.

## 2. What was completed overnight

**Deployed to production:** PR #2 merged to `main` as `06d7581`; Vercel production
deployment `dpl_BAJm4zjQ7v1fL2wiBAmrnpbs1rNT` serves www.getfilewell.com, getfilewell.com
(308 to www) and filewell.vercel.app (308 to www). Commits: `b52140c` (config foundation),
`3452756` (launch fixes), `06d7581` (merge), plus this report's PR.

**Code (all tested, all live):**

- **Payments safety.** Production refuses the sandbox and Stripe test keys regardless of
  any other flag; the unapproved service fee is hidden on production and refused at
  checkout; checkout shows a calm "payments aren't open yet" state instead of a Pay
  button; webhook configuration errors return 503 (Stripe retries); a paid-but-unconfirmed
  earlier checkout is reconciled instead of charging twice; declined cards can be retried;
  Stripe line items read "Pennsylvania Department of State filing fee (passed through at
  cost)" and "Filewell service fee".
- **Canonical domain.** Every absolute link (canonical tags, Open Graph, JSON-LD, sitemap,
  auth confirmation and password-reset links, payment success/cancel URLs, email links)
  uses https://www.getfilewell.com in production, even if the env var is wrong.
  `*.vercel.app` hosts redirect to www (except `/api`). `X-Robots-Tag: noindex` is sent
  while indexing is off. `support@filewell.example` is gone everywhere.
- **Brand config.** Brand name, domain, support address, legal operator and postal address
  live in one place (`src/config/site.ts`) and can be overridden per environment
  (`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_LEGAL_ENTITY`,
  `NEXT_PUBLIC_POSTAL_ADDRESS`, `NEXT_PUBLIC_SITE_URL`). The brand stays "Filewell".
- **Email.** Resend delivers only on the production deployment (previews and tests always
  use the outbox, even though the key is shared); a misconfigured production sender fails
  visibly instead of silently pretending to send; addresses on reserved test domains
  (`.test`, `.example`, `e2e.filewell.test`, ...) are never delivered in any mode; the order
  confirmation lists the state fee and service fee separately; new "document ready" email
  when a receipt is uploaded; staff alerts for new paid orders and customer messages
  (throttled to one per filing per hour); every email footer carries the private-service
  disclaimer and support contact.
- **September 30.** One shared wording helper: "N days left", "Due tomorrow", "Due today",
  then "Deadline passed September 30" (never a negative number, never "late"/"overdue"
  in customer copy). "Pennsylvania charges no state late fee, and the report can still be
  filed" appears only where the verified rule data proves it. Filing stays available
  after the deadline. Date-bearing pages render per request (no stale countdown).
  Verified by running the production build with the clock pinned to Sept 29, Sept 30,
  Oct 1 and Jan 2, 2027 at desktop and mobile width: correct wording on every page, no
  forbidden phrases, "Have us file it" present after the deadline.
- **Operator dashboard.** The admin Today page opens with "Your next step for each paid
  customer": one row per paid filing with its deadline and exactly one instruction
  ("Review the details, then click Mark ready to file", "File on file.dos.pa.gov, then
  click Start filing", "Upload the state's approved report, then click Mark accepted",
  "Read and reply to the customer's message", "Issue the refund", ...). Orders paid in test
  mode carry a red "TEST: no money collected" badge everywhere and are excluded from
  revenue. "Mark ready to file" and "Mark submitted" re-check on the server that the
  customer's signed authorization matches the answers being filed, intake is complete,
  the payment is live (in production) and the rule is verified. Operator success messages
  say whether the customer email was actually sent, only recorded, or failed. A compact
  staff status panel shows payment mode, email delivery, which database is in use, whether
  the fee is approved, and whether indexing is on.
- **Security.** Two audits (189 launch findings; 52 security findings with adversarial
  verification). No cross-customer data access was found: all 36 tables use row-level
  security and the 82 database tests pass. Fixed: sandbox payments on production (high),
  an open-redirect edge case in sign-in `next` links, misleading expired-link copy, missing
  root error pages, internal price/rule columns readable with the public key (migration
  `20260929000007`), the double-charge edge case, and the submit-without-payment check.
- **Legal accuracy.** Terms, Privacy, Refunds, Filing authorization and Disclaimer now
  describe how the product actually works (processors: Supabase, Vercel, Stripe, Resend;
  cookies; authorization is signed on the Review step before payment). They are still
  marked **Draft for legal review** and nothing implies attorney review. The customer's
  authorization text is accurate, names the legal name being filed, agrees to the Terms
  and Refund Policy by date, and is stored with a hash of the exact answers.
- **Guards.** The E2E journey and seed/grant/reminder scripts refuse the production
  database unless explicitly confirmed; against a production host only the read-only
  public smoke test runs.

**Infrastructure (done by the engineer):**

- Production Supabase project **filewell-production** (`tnwpcprvetxtgyjuncrl`, us-east-1,
  $10/month, approved by Amary). All 7 migrations applied; schema, function and security
  policy fingerprints identical to staging. Reference data loaded (PA rules and 186
  official sources, agencies, reminder schedule, the provisional $49 fee, **not approved**)
  and all 15 email templates. **0 users, 0 orders: no test data.**
- Production auth settings: Site URL `https://www.getfilewell.com`, redirect allow-list
  (www and apex only), email confirmation required, password policy matching the app,
  leaked-password check on, branded subjects.
- Vercel Production env: `NEXT_PUBLIC_SITE_URL=https://www.getfilewell.com`,
  `EMAIL_FROM=Filewell <filings@getfilewell.com>`, `EMAIL_REPLY_TO=support@getfilewell.com`.

**Tests run (all passing):**

| Check | Result |
| --- | --- |
| Typecheck, lint | clean |
| Unit + database tests | 414 / 414 (41 files, incl. 82 DB/RLS tests) |
| Production build | passes |
| Playwright, local production build on staging | 21 / 21 (full journey with audit-trail and operator next-step assertions, public pages desktop + mobile, axe accessibility) |
| Playwright, Vercel preview of the merged code | 21 / 21 |
| Playwright public smoke, https://www.getfilewell.com | 14 / 14 (desktop + mobile) |
| Read-only production checks (canonical, redirects, sitemap, robots, noindex, no placeholder email, fee hidden, sandbox refused, admin protected, security headers) | 25 / 25 |
| September 30 transition (4 pinned dates x 2 widths x 5 surfaces) | no negative countdowns, no late-fee claims, filing available |
| Email templates rendered at 390px with production links | correct fees, links, disclaimer, unsubscribe on reminders |

## 3. Remaining launch blockers

Only genuine blockers, each needing Amary:

1. **Production still reads the staging database.** Vercel Production needs the production
   Supabase secret key (the engineer is not allowed to handle it) and then the two public
   Supabase values switched. Until then, sign-ups on www cannot complete email
   confirmation and would land in the test database: don't invite anyone yet.
2. **No real payments.** Stripe account for Filewell (identity, bank), live keys, webhook,
   and your explicit switch-on. The $49 fee is provisional and must be approved first.
3. **Auth emails use Supabase's default mailer** (not for production, rate limited).
   Custom SMTP through Resend needs a Resend API key.
4. **App emails are still outbox-only** on production (`EMAIL_PROVIDER=outbox`); switch to
   `resend` in the same redeploy as blocker 1.
5. **No inbound mail on getfilewell.com.** There is no MX record, so replies to
   support@getfilewell.com bounce. Set up forwarding.
6. **Legal decisions:** the operating legal entity name and postal address (both shown
   publicly and in email footers), and your recorded decision to take the first order
   under draft terms (or get attorney review first). Counsel should confirm the
   authorized-representative e-signature wording.
7. **Vercel plan:** the Hobby plan is for non-commercial use; taking payments needs Pro.
8. **Pennsylvania filing access:** a Business Filing Services login at file.dos.pa.gov and
   a company card for the $7 state fee.

## 4. Amary's morning actions (shortest order)

Do 4.1 to 4.4 in one sitting, then redeploy once (4.5).

**4.1 Supabase production secret into Vercel (5 min)**

1. https://supabase.com/dashboard → project **filewell-production** → Project Settings →
   **API Keys** → Secret keys → `default` → reveal → copy.
2. https://vercel.com → project **filewell** → Settings → **Environment Variables**.
3. `SUPABASE_SECRET_KEY` → ⋯ → Edit → untick **Production** (keep Preview) → Save.
4. **Add New** → Key `SUPABASE_SECRET_KEY` → paste → Environments: **Production** only →
   **Sensitive** on → Save.
5. `NEXT_PUBLIC_SUPABASE_URL` → Edit → untick Production → Save. Add New →
   `NEXT_PUBLIC_SUPABASE_URL` = `https://tnwpcprvetxtgyjuncrl.supabase.co`, Production only.
6. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → Edit → untick Production → Save. Add New →
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_ogSK5NrFsL-9PkG7q3Tmcw_cLCF0XPs`
   (this key is public by design), Production only.

**4.2 Real email (10 min)**

1. Resend → **API Keys** → Create → name `supabase-smtp`, permission **Sending access**,
   domain getfilewell.com → copy.
2. Supabase **filewell-production** → Authentication → **Emails** → SMTP Settings → Enable
   custom SMTP: Sender email `filings@getfilewell.com`, Sender name `Filewell`, Host
   `smtp.resend.com`, Port `465`, Username `resend`, Password = the key → Save. Then
   Authentication → **Rate Limits** → emails per hour → 30 → Save. (Optional: paste the
   branded bodies from OPERATIONS.md, "Supabase Auth settings".)
3. Vercel → Environment Variables → `EMAIL_PROVIDER` → Edit → untick Production → Save.
   Add New → `EMAIL_PROVIDER` = `resend`, Production only.
4. Cloudflare → getfilewell.com → **Email** → Email Routing → Get started → create
   `support@getfilewell.com` → destination: your inbox → verify the destination email →
   let Cloudflare add its MX and SPF records. (Resend's records on `send.` and
   `resend._domainkey` are unaffected.)
5. Cloudflare → DNS → Add record → TXT, name `_dmarc`, content
   `v=DMARC1; p=none; rua=mailto:support@getfilewell.com` → Save.

**4.3 Legal entity (2 min, once you have the values)**

Vercel → Add New → `NEXT_PUBLIC_LEGAL_ENTITY` (e.g. "Your Company LLC") and
`NEXT_PUBLIC_POSTAL_ADDRESS` (one line), Production only.

**4.4 Vercel Pro**

Vercel → team **datadetective1's projects** → Settings → Billing → upgrade to **Pro**.

**4.5 Redeploy and create your admin account (5 min)**

1. Vercel → **Deployments** → the latest Production deployment → ⋯ → **Redeploy**.
2. Open https://www.getfilewell.com/signup, sign up with your real address, click the
   confirmation email (open it in the same browser).
3. Supabase **filewell-production** → **SQL Editor** → run the "No-laptop alternative"
   in OPERATIONS.md → "First admin" (replace the email).
4. Open https://www.getfilewell.com/admin: the staff status panel should show the
   **production** database and email **resend**.

**4.6 Stripe (30 to 60 min plus Stripe's review)**

1. Stripe account for Filewell: activate (identity, bank), Settings → Public details
   (name Filewell, support email support@getfilewell.com, statement descriptor
   `FILEWELL`), Payment methods: cards only.
2. Developers → Webhooks → Add endpoint `https://www.getfilewell.com/api/webhooks/payments/stripe`,
   events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`,
   `refund.updated` → copy the signing secret.
3. Vercel → Production only: `STRIPE_SECRET_KEY` (sk_live..., Sensitive),
   `STRIPE_WEBHOOK_SECRET` (whsec..., Sensitive), `PAYMENTS_PROVIDER` = `stripe` (split the
   existing variable as in 4.1). Remove `SANDBOX_WEBHOOK_SECRET` from Production.
4. https://www.getfilewell.com/admin/pricing → set the final Pennsylvania service fee →
   **Approve**.
5. **Only when you are ready to take money:** Production `PAYMENTS_LIVE_ENABLED` = `true`
   → Redeploy.

**4.7 Prove it with one real order**

Place one real order yourself (your own PA entity, or a friendly first customer), file
it with the runbook below, and check: the Stripe payment shows two line items, the order
confirmation email arrives with separate fees, the operator next step appears on Today,
the documents appear in the customer dashboard, and the "accepted" and "document ready"
emails arrive. Then the verdict is **YES**.

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
- **Back to staging data (emergency only):** restore the three Supabase variables to the
  staging values and redeploy. Real customer data created meanwhile stays in production.

## 7. Known risks

**Launch blockers** (section 3): production database secret, live Stripe + fee approval,
auth SMTP, `EMAIL_PROVIDER=resend`, inbound support mail, legal entity/address and the
draft-terms decision, Vercel Pro, PA filing login and card.

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
