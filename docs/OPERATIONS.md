# Operations runbook: Pennsylvania annual report (manual fulfillment)

This is how one operator fulfils Pennsylvania annual report orders today.

## Before the first order

1. **Business Filing Services account.** Create the company's own login at
   <https://file.dos.pa.gov> (it signs in through the PA Business Hub, which uses
   Keystone Login). Use a shared operations mailbox, not a personal email.
2. **Payment card for state fees.** A company card for the $7 state fee (nonprofits: $0).
   The customer's payment already covers it; the state fee is recorded separately on
   each order.
3. **Staff access.** `npm run grant-staff -- operator@company.com operator`
   (admins can also refund and change prices). Against production see
   [First admin](#first-admin) below.

## Daily routine

1. Open `/admin` (Today). Handle anything under **Critical exceptions** first:
   filings due within 3 days, payments flagged for review, webhook errors, failed reminders.
2. Open `/admin/queue` (default: active orders sorted by deadline).
3. Open `/admin/notifications?status=failed`. A failed email means the customer did not
   get it: fix the cause, then contact the customer another way (reply from the support
   mailbox or send a message on the filing).
4. Read the support mailbox (support@getfilewell.com) and answer anything waiting.

## Filing one order

1. Open the order. Check **Payment** is `Paid` with a **live** payment (never file an
   order whose payment mode is sandbox or test: no money was collected), and
   **Authorization** is recorded. Read the filing's **messages** for a cancellation
   request, and check the Stripe dashboard for a dispute or early-fraud warning on the
   payment. If either exists, do not file: reply to the customer first.
2. Review the submitted information. If something is missing or looks wrong, use
   **Request customer information** (the customer is emailed, and the order moves to
   *Needs customer action*). Otherwise click **Mark ready to file**.
3. Click **Open filing packet**. Keep it open next to the state site.
4. Click **Start filing**, then **Open official filing site**:
   - Log in to file.dos.pa.gov → **Business Search** → find the entity (use the entity
     number in the packet, or look it up on the public search).
   - Click **File Annual Report** (no PIN needed).
   - Confirm or update each field so it matches the packet exactly: registered office or
     CROP + county, principal office, governor(s), principal officers.
   - Tick the declarations, e-sign with the signature wording in the packet, pay the fee.
5. Online reports are approved automatically, usually within minutes. **Download the filed
   Form and the Acknowledgement Letter immediately**: the state keeps them only 60 days.
6. Back in the order: **Mark submitted** with the state confirmation number and date.
7. **Upload** the filed report and acknowledgement (kind: *Filed report* / *Acknowledgement*,
   visible to customer).
8. **Mark accepted**. With documents on file the order completes automatically: the
   customer is emailed, the documents appear in their dashboard, that period's reminders
   stop, and next year's requirement is opened.

## Problems

- **Rejected by the state:** **Mark rejected** with the reason (customer is emailed), fix,
  then **Reopen** → file again.
- **Customer wants to cancel before filing** (a message on the filing or an email from
  the account's address): **Cancel** (reason), then **Refund** (admins). After submission
  the state fee is not refundable (state fees are nonrefundable).
- **Customer asks to close their account** (email from the account's address): turn off
  reminder emails for that profile (Supabase Table Editor: `profiles.reminder_emails_enabled`
  = false), cancel and refund any order not yet submitted, then block sign-in in Supabase
  (Authentication > Users > the user > ban). Do not delete order, filing, authorization,
  payment, refund, notification or message rows; they are kept as the privacy policy says,
  and the database refuses to delete a user who has orders. Reply to confirm that they can
  no longer sign in and reminder emails have stopped. Nothing else is deleted by this step.
- **Customer asks us to delete their information** (email from the account's address):
  clear `profiles.full_name` and `profiles.phone` and delete the account's
  `analytics_events` rows (filter by `user_id`) in the Supabase Table Editor, then pass
  the request to the owner, who decides whether anything else can go. Filing,
  authorization, payment, refund, notification, message and audit rows are never deleted
  (the privacy policy keeps them for the retention period). Reply with what was done.
- **Duplicate payment** (flagged in `/admin/payments`): refund the duplicate payment.
- **Webhook errors:** `/admin/payments` lists events that failed processing; the processor
  retries automatically, and processing is idempotent.

## Things you must never do

- Never file anything the customer has not authorized.
- Never change an order's status outside the console (every change is audited).
- Never tell a customer their business "will be dissolved" unless a published rule says so.
  For Pennsylvania: no late fee; dissolution/termination applies starting with reports due
  in 2027, six months after the due date.

# Production

Production is https://www.getfilewell.com (the apex redirects to `www`; production
`*.vercel.app` aliases redirect there too, except `/api/*`). Staging is the Preview target
plus the staging Supabase project. Status of each item: [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

**Production credentials never go in `.env.local`.** `.env.local` is loaded by `next dev`,
Playwright and every script, so it only ever points at local or staging. For a one-off
production script, set the variables in that terminal for that one command (shell values
win over `.env.local`) and close the terminal afterwards.

## Environment matrix

Vercel project `filewell`. "Secret" = sensitive type, never shared between targets.
`NEXT_PUBLIC_*` values are inlined at build time. Any env change needs a new deployment to
take effect.

| Variable | Production | Preview (staging) | Development (local) | Secret |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.getfilewell.com` | unset (deployment URL) | `http://localhost:3000` | no |
| `NEXT_PUBLIC_BRAND_NAME` | unset (`Filewell`) | unset | unset | no |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | unset (`support@getfilewell.com`) | unset | unset | no |
| `NEXT_PUBLIC_LEGAL_ENTITY` | company legal name, once known | unset | unset | no |
| `NEXT_PUBLIC_POSTAL_ADDRESS` | mailing address, once known | unset | unset | no |
| `NEXT_PUBLIC_ALLOW_INDEXING` | `false` until owner approval | `false` | `false` | no |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tnwpcprvetxtgyjuncrl.supabase.co` | `https://iskphxoowsiuvvojswty.supabase.co` | local stack or staging | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production key | staging key | local or staging key | no (public) |
| `SUPABASE_SECRET_KEY` | production key | staging key | local or staging key | yes |
| `APP_SIGNING_SECRET` | own value (32+ chars) | own value | own value | yes |
| `IP_HASH_SALT` | own value (16+ chars) | own value | optional (a dev default is used; leave out, never blank) | yes |
| `CRON_SECRET` | own value (cron runs on Production only) | optional (leave out, never blank) | optional (leave out, never blank) | yes |
| `PAYMENTS_PROVIDER` | `stripe` (until then checkout is unavailable) | `sandbox` (E2E needs it) | `sandbox` | no |
| `PAYMENTS_LIVE_ENABLED` | `true` only after owner approval | `false` | `false` | no |
| `STRIPE_SECRET_KEY` | `sk_live_...` | unset | `sk_test_...` only for a local Stripe test | yes |
| `STRIPE_WEBHOOK_SECRET` | secret of the live endpoint | unset | from `stripe listen` | yes |
| `SANDBOX_WEBHOOK_SECRET` | **not set** | set | set | yes |
| `ALLOW_TEST_PAYMENTS_IN_PRODUCTION` | **never set** | unset | unset | no |
| `ALLOW_SANDBOX_IN_PRODUCTION` (older name; builds before this sprint still honor it) | **never set**; remove it if present | **never set** | **never set** | no |
| `ALLOW_REAL_PAYMENTS_IN_TESTS` | **never set** | **never set** | **never set** (tests stay on the sandbox) | no |
| `EMAIL_PROVIDER` | `resend` (or unset: resend is the production default) | `outbox` | `outbox` | no |
| `RESEND_API_KEY` | production sending key | **not set** | not set | yes |
| `EMAIL_FROM` | `Filewell <filings@getfilewell.com>` | unset | unset | no |
| `EMAIL_REPLY_TO` | `support@getfilewell.com` | unset | unset | no |
| `EMAIL_DELIVERY_OUTSIDE_PRODUCTION` | unset | only for a deliberate deliverability check, then remove | never | no |
| `FILEWELL_CLOCK_OVERRIDE` | never (ignored) | only for date QA | optional | no |
| `CONFIRM_PRODUCTION` | never | never | command line only | no |

Previews stay on the outbox unless `EMAIL_PROVIDER=resend` and
`EMAIL_DELIVERY_OUTSIDE_PRODUCTION=true`. They would take real payments if given `sk_live_`
keys and `PAYMENTS_LIVE_ENABLED=true`, so set the live Stripe key, `STRIPE_WEBHOOK_SECRET`
and `PAYMENTS_LIVE_ENABLED` on the **Production** target only and never on "All
environments". Production refuses the sandbox and Stripe test keys.

Optional variables are left out entirely, never set to an empty value: an empty
`IP_HASH_SALT`, `CRON_SECRET` or `SANDBOX_WEBHOOK_SECRET` fails validation, and every payment
and email path then errors.

Playwright also reads `E2E_BASE_URL`, `E2E_SHARE_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET` and a
`.env.e2e` override file (see `.env.example`). These belong on a developer machine or in CI,
never in Vercel.

## Production Supabase bootstrap

Project `tnwpcprvetxtgyjuncrl` (filewell-production, us-east-1, Pro org).

1. Migrations, in order (applied 2026-09-29): `20260927000001_schema`,
   `20260927000002_functions`, `20260927000003_rls`, `20260927000004_storage` (private
   `filing-documents` bucket), `20260928000005_indexes`, `20260928000006_payment_guards`,
   `20260929000007_column_grants` (applied 2026-09-29 to staging and production). Schema,
   function and policy fingerprints match staging exactly.
2. Seed = reference data only (states, agencies, filing types, PA rules and sources,
   reminder schedule, notification templates, and a provisional unapproved PA price when
   none exists). **Done 2026-09-29:** production holds 51 states, 51 agencies, 11 filing
   types, the 8 current PA rule versions with 186 sources, the reminder schedule, the
   provisional $49 price (not approved) and all 15 notification templates, identical to
   the seeded staging data; 0 users, 0 orders. Re-running is idempotent:
   `CONFIRM_PRODUCTION=tnwpcprvetxtgyjuncrl npm run seed`, with the production URL and
   secret key set in that terminal only.
3. Point the Vercel **Production** target at this project (URL, publishable key, secret
   key), keep staging on Preview and Development, and redeploy production.
4. Configure Auth ([below](#supabase-auth-settings)), then create the [first admin](#first-admin).

Forbidden in production: the E2E journey (`tests/e2e/journey.spec.ts` and its
service-role helpers), demo or test-data scripts, the sandbox payment provider, and any
`e2e.filewell.test` or other test users. Only `tests/e2e/public.spec.ts` (read-only) may
run against https://www.getfilewell.com. Never copy staging data into production.

### First admin

1. The owner signs up at https://www.getfilewell.com/signup with a real, monitored
   address and confirms the email.
2. In a fresh terminal with the production `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SECRET_KEY` set for that session only:
   `CONFIRM_PRODUCTION=tnwpcprvetxtgyjuncrl npm run grant-staff -- <owner email> admin`.
   The script prints the target project and writes a `staff.granted` audit row.
   **No-laptop alternative:** Supabase dashboard → project `filewell-production` → SQL
   Editor → run (replace the email in both statements):

   ```sql
   insert into public.staff_members (user_id, role, active, display_name)
   select id, 'admin', true, split_part(email, '@', 1) from auth.users where email = 'you@example.com'
   on conflict (user_id) do update set role = 'admin', active = true;
   insert into public.audit_logs (actor_type, action, entity_type, entity_id, after)
   select 'system', 'staff.granted', 'staff_member', id::text, jsonb_build_object('role', 'admin')
   from auth.users where email = 'you@example.com';
   ```
3. Grant staff only to real operators. Revoke with `npm run grant-staff -- <email> revoke`.

## Supabase Auth settings

Production project, Authentication settings. **Applied 2026-09-29 on the production
project:** Site URL, redirect URLs (`https://www.getfilewell.com/**`,
`https://getfilewell.com/**`), Confirm email ON (autoconfirm off), password policy (10+,
lower/upper/digit), leaked-password protection ON, branded subjects ("Confirm your
Filewell account", "Reset your Filewell password"). **Still to do by the owner:** custom
SMTP and (optional) the branded template bodies below.

- **URL configuration:** Site URL `https://www.getfilewell.com`. Redirect URLs
  `https://www.getfilewell.com/auth/confirm` and `https://www.getfilewell.com/**`. No
  localhost entries. On the **staging** project only, add the preview pattern (for example
  `https://*-datadetective1s-projects.vercel.app/**`).
- **Email provider:** Confirm email ON. Secure email change ON.
- **Passwords:** minimum length 10, lowercase + uppercase + digits (matches the app),
  leaked-password protection ON.
- **Custom SMTP (Resend):** host `smtp.resend.com`, port `465`, username `resend`,
  password = a separate Resend API key (Sending access, getfilewell.com only), sender
  `filings@getfilewell.com`, sender name `Filewell`. Then raise the email rate limit to at
  least 30 per hour.
- **Templates:** "Confirm signup" and "Reset password" use the brand name and the line
  "Private filing service. Not affiliated with or endorsed by any government agency."
  Keep `{{ .ConfirmationURL }}`.
- **Paste-ready template bodies** (Authentication → Emails → Templates). Confirm signup:

  ```html
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#17231d">
  <p style="font-size:18px;font-weight:bold;margin:0 0 16px">Filewell</p>
  <h2 style="font-size:20px;margin:0 0 12px">Confirm your email</h2>
  <p style="font-size:15px;line-height:22px">Thanks for creating a Filewell account. Confirm your email address to finish signing up.</p>
  <p style="margin:24px 0"><a href="{{ .ConfirmationURL }}" style="background:#1f5a43;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold;display:inline-block">Confirm my email</a></p>
  <p style="font-size:14px;line-height:20px;color:#4b5650">Open the link on the same device and browser you used to sign up. If you didn't create a Filewell account, you can ignore this email.</p>
  <p style="color:#6b7280;font-size:12px;line-height:18px;margin-top:24px">Filewell is a private filing service. Not affiliated with or endorsed by any government agency. Questions? Write to support@getfilewell.com.</p>
  </div>
  ```

  Reset password: the same block with the heading "Reset your password", the lead "We
  received a request to reset the password for your Filewell account.", the button "Choose
  a new password" and the note "If you didn't ask for this, you can ignore this email; your
  password won't change."
- **Test:** sign up and reset a password with an address outside the team. The link must
  open `https://www.getfilewell.com/auth/confirm` and land signed in.

## Resend and inbound mail

- getfilewell.com is verified in Resend. Keep open and click tracking OFF (transactional
  mail; the app tracks its own link clicks).
- Addresses: `filings@getfilewell.com` = transactional From. `support@getfilewell.com` =
  Reply-To and public support. `billing@getfilewell.com` optional.
- API keys: one for the app (`RESEND_API_KEY`, Vercel **Production target only**), a
  separate one for Supabase SMTP. Both Sending access, restricted to getfilewell.com.
- **Inbound mail needs MX records on getfilewell.com.** Today there are none, so replies
  and mail to support@ bounce. Add a receiving service, for example Cloudflare Email
  Routing forwarding support@, hello@, billing@ and dmarc@ to the owner's inbox, and name
  who reads it.
- DMARC: TXT at `_dmarc.getfilewell.com` = `v=DMARC1; p=none; rua=mailto:dmarc@getfilewell.com`
  to start; move to `p=quarantine` after a few clean weeks.
- Verify: one real order and a password reset; in Gmail "Show original" SPF, DKIM and
  DMARC show PASS; `/admin/notifications` rows show provider `resend`.

## Stripe production setup

1. Stripe account for this business, verification complete. Describe it as a private
   filing-preparation service (MCC 7399 or 8999, never a government MCC).
2. Public details: business name `Filewell` (or the legal entity), statement descriptor
   `FILEWELL` (22 characters max, nothing that reads like a state agency), support email
   `support@getfilewell.com`, website `https://www.getfilewell.com`, support URL
   `https://www.getfilewell.com/help`.
3. Settings: customer email receipts ON; payment methods = cards and wallets only
   (instant settlement); Radar default rules ON; dispute and early-fraud-warning
   notifications to the owner.
4. Webhook endpoint `https://www.getfilewell.com/api/webhooks/payments/stripe` (the `www`
   host: Stripe does not follow the apex redirect), API version `2026-08-26.dahlia` (the
   SDK's pinned version). Events the adapter handles (`src/lib/payments/stripe.ts`):
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`,
   `refund.created`, `refund.updated`. (`payment_intent.payment_failed` is ignored and
   need not be sent.) The endpoint's signing secret is `STRIPE_WEBHOOK_SECRET` on Production.
5. Test mode first, off production (production refuses test keys): locally with
   `sk_test_` keys in `.env.local`, `PAYMENTS_PROVIDER=stripe` and
   `stripe listen --forward-to localhost:3000/api/webhooks/payments/stripe`; run a
   purchase and a refund end to end.
6. Get a determination on sales tax for the service fee.

## Approving the service fee

Owner only, signed in as admin: `/admin/pricing` → **Change fee** if needed (saving resets
approval) → **Approve price** → confirm "I approve this price for live payments". Live
checkout refuses an unapproved price. Afterwards check that `/pricing`, the Pennsylvania
page and checkout show the same fee. Never approve on the owner's behalf.

## Turning on live payments (owner approval)

Preconditions: Stripe setup done, test-mode run passed, fee approved, production on its
own Supabase project, email delivering, legal decision recorded (LAUNCH_CHECKLIST).

1. Vercel Production only: `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_live_...`,
   `STRIPE_WEBHOOK_SECRET`, `PAYMENTS_LIVE_ENABLED=true`. Remove `SANDBOX_WEBHOOK_SECRET`
   from Production. Redeploy.
2. Check that the staff status on `/admin` reports live payments, then place one owner
   order and confirm the webhook marks it paid (cancel and refund it if it is not a real
   filing).
3. To stop taking payments: set `PAYMENTS_LIVE_ENABLED=false` and redeploy. Checkout then
   shows payments as unavailable, and orders already paid stay paid. While switched off,
   Stripe webhooks get 503 and are retried (up to 3 days), so a checkout completed just
   before the switch shows as paid only after you switch back. Console refunds also fail.
   Refund from the Stripe dashboard if needed; the refund is recorded when webhooks resume.

## Turning on indexing (owner approval)

1. All launch gates done, and the legal pages attorney-reviewed.
2. Owner's written approval.
3. `NEXT_PUBLIC_SITE_URL=https://www.getfilewell.com` on Production (already set).
4. Set `NEXT_PUBLIC_ALLOW_INDEXING=true` on the **Production** target only and redeploy.
5. Verify: `/robots.txt` shows `Allow: /` and `Sitemap: https://www.getfilewell.com/sitemap.xml`;
   the home page has `<meta name="robots" content="index, follow">`; sitemap URLs use
   `https://www.getfilewell.com`; `/login` and unverified state pages stay `noindex`.
6. The owner submits the sitemap in Google Search Console and Bing Webmaster Tools.
7. Rollback: set the flag to `false` and redeploy.

## Incidents and recovery

- **Bad deploy:** Vercel → Deployments → Instant Rollback to the previous production
  deployment.
- **Database:** Supabase → Database → Backups (daily, 7-day retention on the Pro plan).
  A restore takes the project offline for a while and loses writes made after the backup.
- **Stored files are not in database backups.** Filed reports and PA acknowledgement
  letters live only in the private `filing-documents` bucket. When you upload one, also
  keep a copy in the company drive.
- **Records and accounting:** export `orders`, `payments`, `refunds` and `filings` as CSV
  from the Supabase Table Editor; use Stripe reports for payouts and fees.
- **Payments or email trouble:** set `PAYMENTS_LIVE_ENABLED=false` and redeploy to stop
  new orders (webhooks and console refunds pause too; see
  [Turning on live payments](#turning-on-live-payments-owner-approval), step 3); failed
  emails appear in `/admin/notifications?status=failed`.
- **Leaked secret:** rotate it at the provider (Supabase, Stripe, Resend), update the
  Production variable, redeploy.
- Never delete the production Supabase project: that deletes its backups too.
