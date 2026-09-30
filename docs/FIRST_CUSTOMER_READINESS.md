# First-customer readiness: Filewell, Pennsylvania

Overnight launch-readiness sprint, 2026-09-30, against the live configuration (Vercel env,
Supabase production, live Stripe account via the Stripe CLI `--project-name=filewell --live`,
live site). Canonical site: https://www.getfilewell.com. Checklist:
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md). Runbooks: [OPERATIONS.md](OPERATIONS.md).

## 1. Verdict

**CAN FILEWELL TECHNICALLY ACCEPT ITS FIRST $56 CUSTOMER? NO, not yet.** Everything the
engineer can do is done and verified. What remains needs you: resolve two past-due Stripe
requirements (bank account, identity-verification challenge), paste the live secret key and
webhook signing secret into Vercel, then run the controlled first payment (section 5) and
switch on. After those steps, with the status panel green, the answer is YES.

Payments stay **off** (`PAYMENTS_LIVE_ENABLED=false` on Production). Search indexing stays
**off**. No money has moved.

## 2. Completed overnight

**Payment architecture audit (no rewrite needed).** One provider abstraction
(`src/lib/payments`), Stripe hosted Checkout (no card data touches Filewell), and:
- Webhooks verified with Stripe's signature and timestamp; unsigned or forged requests get
  400; payments not configured gets 503 (Stripe retries).
- Idempotent: `payment_events(provider, provider_event_id)` is unique; a replayed event is
  a no-op.
- An order becomes paid only in the database function `apply_payment_success`, which
  checks the amount and currency against the order, matches the session to its own payment
  (metadata cross-check), flags a second payment for an already-paid order for refund, and
  sends an unauthorized or incomplete filing to "needs information" instead of the work
  queue.
- The success redirect never marks anything paid by itself: the return page re-reads the
  session from Stripe and applies it through the same function.
- Checkout is refused unless the filing is authorized, the details still match the signed
  authorization (hash), the price is approved, and live mode is on. A retry expires or
  applies older sessions first, so a customer cannot pay twice by double-clicking.
- Prices come from the database, never from the browser; the order stores state fee,
  service fee and total separately, and refunds record both parts.

**Changes (branch `launch/stripe-readiness`, merged to main and deployed; see git log):**
1. Admin → System status now has **Stripe account** and **Stripe webhook** rows: a live,
   read-only check (charges, payouts, outstanding requirements, statement descriptor;
   endpoint URL, events and API version) that works while checkout is still off. It never
   reads or shows a secret.
2. Checkout offers only **card** (with Apple Pay / Google Pay) and **Link**. The account
   also has ACH, Klarna, Afterpay, Cash App and others active; those are excluded in code
   so every order settles instantly before we file.
3. Legal pages: bracketed placeholders resolved without inventing facts (retention periods,
   refund reply time, PA fee-refund wording, disputes clause); the operator is shown as
   **Amary Coulibaly, sole proprietor**; "private business" (not "company"); postal address
   reads "available on request from support@getfilewell.com" (no private address
   published); governing law stays bracketed until you choose it (one env var).
   `LEGAL_LAST_UPDATED` = 2026-09-30. No LLC, DBA, EIN or attorney review is claimed; the
   "Draft for legal review" banner remains because no attorney has reviewed the terms.

**Configuration:**
- Production PA service price **$49.00 approved** (your written approval; recorded with an
  audit row). PA state fee **$7.00** (from the verified rule; $0 for nonprofit LLCs and
  nonprofit corporations). Checkout total **$56.00**, shown as two lines.
- Vercel: `PAYMENTS_PROVIDER=stripe` on Production, `sandbox` on Preview/Development;
  `PAYMENTS_LIVE_ENABLED` has its own Production variable (`false`), so switching on
  touches only Production. `NEXT_PUBLIC_LEGAL_ENTITY` set on Production.
- Stripe live webhook endpoint created: `we_1ULElQ0kBic3wOhxnXQTsnHJ` →
  `https://www.getfilewell.com/api/webhooks/payments/stripe`, enabled, API version
  `2026-08-26.dahlia` (the SDK's), exactly the six events the code handles. Its signing
  secret was not printed or stored anywhere by the engineer.

**Tests (all passing):** typecheck, lint, production build, 344 unit tests, 82 database
tests (real Postgres with the production migrations: payment guards, replay dedupe, amount
and currency mismatch, duplicate payment, out-of-order events, partial/full refunds, RLS),
21/21 E2E on the staging preview (sign-in, intake, authorization, sandbox payment,
duplicate and forged webhooks harmless, cross-customer isolation, operator filing,
customer notification and receipt download, desktop and mobile public pages). After the
production deploy: 33/33 read-only production checks (www/apex redirects, canonical,
noindex, security headers, $49 + $7 = $56 on /pricing, operator named on the terms, no
retention/reply-time placeholders, Stripe webhook 503 while unconfigured, sandbox closed,
admin requires sign-in), 14/14 public E2E on production (desktop + mobile), no horizontal
overflow at 375px. Production data unchanged: 0 orders, 0 payments, 0 live Stripe charges.

**Live checkout verified without moving money:** a live Checkout Session with the
production parameters was accepted by Stripe (line items "Filewell service fee" $49.00 and
"Pennsylvania Department of State filing fee (passed through at cost)" $7.00, total
$56.00, card + Link, checkout.stripe.com) and expired immediately, unpaid. No order was
created in Filewell. Its `checkout.session.expired` event is being retried against the
webhook (503 until your keys are in) and will be ignored as unmatched; if Stripe emails you
about a failed webhook delivery tonight, that is the cause.

## 3. Stripe live status

| Item | Status |
|---|---|
| Account | `acct_1ULCTn0kBic3wOhx`, US, individual (sole proprietor) |
| Charges enabled | Yes |
| Payouts enabled | Yes |
| Details submitted | Yes |
| Requirements outstanding | **Past due:** `external_account` (no bank account for payouts) and an identity-verification challenge. Nothing pending review. Stripe may pause charges or payouts until these are done |
| Public details | Name Filewell, website www.getfilewell.com, MCC 7399, descriptor `FILEWELL`. Support email **empty** |
| Webhook | Created and enabled (`we_1ULElQ0kBic3wOhxnXQTsnHJ`, 6 events, correct API version) |
| Production keys connected | **No.** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be added by you |
| $49 service price | Approved and configured |
| $7 PA fee | Configured (verified rule) |
| Checkout | Verified live (unpaid session, expired) |
| Stripe Tax | Off, as decided. No tax is added |
| Live charging | Off (`PAYMENTS_LIVE_ENABLED=false`) |

## 4. Remaining human actions (shortest path)

**4.1 Stripe past-due items (10 min).** https://dashboard.stripe.com (Filewell account,
live) →
1. Follow the banner at the top ("verify your identity" / "Action required") and complete
   the identity challenge.
2. Settings → Business → **Payouts** (or Balances → Payout account) → add your bank
   account.
3. Settings → Business → **Public details** → Support email `support@getfilewell.com`,
   support URL `https://www.getfilewell.com/help` → Save.
4. Settings → Business → Customer emails → **Successful payments** ON and **Refunds** ON.

**4.2 Keys into Vercel (5 min).**
1. Stripe → Developers → **API keys** → Secret key → Reveal (or create one named
   `filewell-production`) → copy. Use the `sk_live_...` key, not the Stripe CLI's key.
2. Vercel → filewell → Settings → Environment Variables → Add: key `STRIPE_SECRET_KEY`,
   value the key, environment **Production only**, **Sensitive** on → Save.
3. Stripe → Developers → **Webhooks** → the endpoint
   `https://www.getfilewell.com/api/webhooks/payments/stripe` → Signing secret → Reveal →
   copy (`whsec_...`).
4. Vercel → Add: `STRIPE_WEBHOOK_SECRET`, **Production only**, **Sensitive** → Save.
5. Vercel → Deployments → the latest Production deployment → ⋯ → **Redeploy**.
6. https://www.getfilewell.com/admin → System status: **Stripe account** "Live: charges on,
   payouts on" with no "Stripe needs" note; **Stripe webhook** "Active: all required
   events"; **Payments** still "Off" (note: live key present but PAYMENTS_LIVE_ENABLED is
   not 'true'). **PA service price** "Approved".

**4.3 Governing law (1 min, recommended before the first real customer).** Choose the
state whose law governs your terms (typically the state where you live and operate the
business). Vercel → Add `NEXT_PUBLIC_GOVERNING_LAW` = for example
`the Commonwealth of Pennsylvania` (Production) → Redeploy. Until then Terms section 17
shows a bracketed placeholder.

**4.4 Decisions to record (your call, not engineering):**
- Selling under terms that no attorney has reviewed (the legal pages say so), and whether
  counsel should confirm the authorized-representative e-signature wording first.
- Operating as "Filewell" under your own name: many states (Pennsylvania included) require
  an individual using a business name other than their own to register it as a fictitious
  name. Check the rule where you do business; the site claims no DBA registration.
- Optional: a public postal address (a mailbox service, not your home) for
  `NEXT_PUBLIC_POSTAL_ADDRESS`.

**4.5 The controlled first live payment** (section 5), then switch on.

## 5. First live payment test

The existing production draft is for **DAFF TRUCKING LLC**. Treat it as a test artifact:
never file it with Pennsylvania unless you are authorized to act for that business.

1. **Enable live checkout.** Vercel → Environment Variables → the **Production**
   `PAYMENTS_LIVE_ENABLED` → Edit → `true` → Save → Deployments → latest Production → ⋯ →
   Redeploy. `/admin` must read Payments **Live: real charges**.
2. **Pay $56 yourself.** Signed in as yourself: Dashboard → the draft filing → continue
   to Review (re-sign the authorization if asked) → Checkout. The page must show state fee
   $7.00, service fee $49.00, total $56.00 → **Pay** → on Stripe, the same two lines and
   $56.00 → pay with your own card.
3. **Confirm Stripe.** Stripe → Payments: one $56.00 payment, Succeeded, descriptor
   FILEWELL. Developers → Webhooks → the endpoint → Event deliveries: 200 for
   `checkout.session.completed`.
4. **Confirm Filewell.** You land on the confirmation page. `/admin/payments`: the order
   is Paid, live mode, $56.00 ($7.00 + $49.00), no review flag. Emails: "Order confirmed"
   to you and "New paid order" staff alert; `/admin/notifications` shows both `sent`.
5. **Confirm the queue.** `/admin` → "Your next step for each paid customer" shows the
   filing with **no** TEST badge, status Ready for review.
6. **No state filing.** Do not click Start filing or open the state site for this order.
7. **Refund decision.** Unless you are authorized for this business and want it filed:
   open the filing → **Cancel** (reason "Owner payment test") → **Refund** the full $56.00.
   Check: Stripe shows the refund; `/admin/payments` shows it refunded; you receive the
   "Refund issued" email. Stripe keeps its processing fee (about $1.92) on a refunded
   payment.
8. **If anything is inconsistent** (payment succeeded but the order is not Paid, wrong
   amount, a missing email, a webhook error on `/admin/payments`): set Production
   `PAYMENTS_LIVE_ENABLED` back to `false` and redeploy immediately, refund from the Stripe
   dashboard if needed, and keep the evidence (screenshots, event IDs) for the engineer.

If every check passes, leave live payments on (or switch them off until you are ready to
announce). The verdict is then YES.

## 6. First real customer runbook

1. **Payment received.** You get a "New paid order" email (from filings@getfilewell.com).
   The customer gets "Order confirmed" with the $7 state fee and $49 service fee on
   separate lines.
2. **Find the order.** https://www.getfilewell.com/admin → "Your next step for each paid
   customer" (soonest deadline first). No TEST badge. Open the filing: Payment `Paid`,
   authorization recorded ("The details and authorization check out"), no customer message
   asking to cancel. In Stripe, check there is no dispute or early-fraud warning.
3. **Review the answers** (legal name, entity number, registered office or CROP + county,
   principal office, governors, officers). If something is missing: **Request customer
   information** (customer gets "Action needed"; the filing waits). Otherwise **Mark ready
   to file**.
4. **File on Pennsylvania's portal.** **Open filing packet** and keep it beside the state
   site. **Start filing** → **Open official filing site** → file.dos.pa.gov → log in →
   Business Search → the entity → **File Annual Report** → copy each value exactly as the
   packet shows → declarations → e-sign with the packet's signature wording → pay the
   $7.00 with your card.
5. PA approves online reports automatically, usually within minutes. **Download the filed
   report and the acknowledgement letter right away** (the state keeps them 60 days); keep
   copies in your drive too.
6. **Mark submitted** in the filing with Pennsylvania's confirmation number (customer gets
   "Submitted" with the number).
7. **Upload** the filed report and acknowledgement (Document type *Filed report* /
   *Acknowledgement letter*, visible to customer). The customer gets "Your document is
   ready".
8. **Mark accepted.** With the documents on file the filing completes: the customer gets
   "Your filing was accepted", this year's reminders stop and next year's requirement and
   reminders are created.
9. **Check Emails** (`/admin/notifications`): each message shows provider `resend`, status
   `sent`.

Rejection, cancellation and refunds: OPERATIONS.md, "Problems".

## 7. Rollback

- **Disable checkout immediately (keeps all data):** Vercel → Environment Variables →
  Production `PAYMENTS_LIVE_ENABLED` → `false` → Save → Redeploy (about 1 to 2 minutes).
  Checkout then says payments aren't open; accounts, filings, orders and payments are
  untouched; paid orders stay paid. Stripe webhooks get 503 and are retried for up to 3
  days, so nothing is lost; refunds meanwhile go through the Stripe dashboard.
- **Stop sending email:** Production `EMAIL_PROVIDER` = `outbox` → Redeploy (emails are
  still recorded in `/admin/notifications`).
- **Revert the site:** Vercel → Deployments → previous good Production deployment → ⋯ →
  **Promote to Production** (instant). The database needs no rollback; every migration is
  backward compatible.
- **Supabase keys:** production reads `NEXT_PUBLIC_SUPABASE_URL`, the Production-only
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Never put a
  staging value on the Production target; check "Database keys" on `/admin` after any
  change.

## 8. Known risks

**Before the first real customer:** the items in section 4.

**Can fix after the first customer**
- Sales-tax determination for the service fee (Stripe Tax deliberately off).
- Production and Preview share `APP_SIGNING_SECRET`, `IP_HASH_SALT` and `CRON_SECRET`;
  give Production its own values. `SANDBOX_WEBHOOK_SECRET` is unused on Production.
- Customers can edit their own intake answers through the database API while a filing is
  editable (own filing only); the ready-to-file hash check catches it.
- Sign-in, sign-up and reset throttles are per IP only.
- Stuck-payment cases are listed on `/admin/payments` but not emailed to staff.
- Two admins refunding the same order at the same moment could over-refund (single
  operator today).
- Branded Supabase auth email bodies (defaults work; subjects are branded).

**Future**
- Before Jan 1, 2027: confirm whether Pennsylvania accepts a 2026 report after Dec 31.
- Error monitoring/alerting and a record of each reminder cron run.
- Search indexing (only with your written approval; OPERATIONS.md).
