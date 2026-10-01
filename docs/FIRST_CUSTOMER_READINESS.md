# First-customer readiness: Filewell, Pennsylvania

Overnight launch-readiness sprint, 2026-09-30, against the live configuration (Vercel env,
Supabase production, live Stripe account via the Stripe CLI `--project-name=filewell --live`,
live site). Canonical site: https://www.getfilewell.com. Checklist:
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md). Runbooks: [OPERATIONS.md](OPERATIONS.md).

## 1. Verdict

**CAN FILEWELL ACCEPT ITS FIRST REAL PAYING CUSTOMER? YES** (re-audited 2026-09-30 evening,
after the first controlled live payment).

- Live payment proven end to end: $56.00 (state fee $7.00 + service fee $49.00) paid with
  Link, Stripe `succeeded`, webhook `checkout.session.completed` processed once
  (`payment_succeeded`), one order `paid` (live), one payment `succeeded`, no review flag,
  filing moved to Ready for review, exactly one customer "Order confirmed" and one staff
  "New paid order" email (both `sent` via Resend), no duplicate payment, order or refund.
- Production Payments are **live** (`PAYMENTS_LIVE_ENABLED=true` on Production only);
  Preview/Development stay on the sandbox. Search indexing is **off**.
- Housekeeping before announcing: refund and cancel the DAFF TRUCKING LLC test order
  (section 5) so it leaves the queue.

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

## 3. Stripe live status (re-checked 2026-09-30 evening)

| Item | Status |
|---|---|
| Account | `acct_1ULCTn0kBic3wOhx`, US, individual (sole proprietor) |
| Charges / payouts | Enabled / enabled; bank account on file |
| Requirements | None currently due, past due or pending; no disabled reason |
| Public details | Filewell, www.getfilewell.com, support@getfilewell.com, MCC 7399, descriptor FILEWELL. Time zone `Etc/UTC` (change to Eastern, section 5) |
| Webhook | `we_1ULElQ0kBic3wOhxnXQTsnHJ` enabled, 6 events, API `2026-08-26.dahlia`; nothing pending |
| Production keys | Connected (live key valid: the live payment and webhook succeeded) |
| Prices | $49.00 service fee approved; $7.00 PA fee from the verified rule |
| Live charging | On in Production (`PAYMENTS_LIVE_ENABLED=true`), off on Preview/Development |

## 4. Remaining human actions

1. Refund and cancel the DAFF TRUCKING LLC test order (section 5).
2. Stripe time zone → Eastern (section 5), so receipts match Filewell.
3. Governing law: Vercel → add `NEXT_PUBLIC_GOVERNING_LAW` (Production), e.g.
   `the Commonwealth of Pennsylvania` → Redeploy. Until then Terms section 17 shows a
   bracketed placeholder.
4. Your decisions: selling before an attorney reviews the terms; whether you must register
   "Filewell" as a fictitious name where you do business; optional public postal address.
5. Before search indexing: the gates in section 8 ("Future").

## 5. Controlled live payment test: done; refund and close it

Done 2026-09-30 9:16 PM EDT (01:16 UTC Oct 1): order `cf143b71`, payment intent
`pi_3ULYbb0kBic3wOhx1icJfJSO`, charge `ch_3ULYbb0kBic3wOhx1lb3Maqf` (Link, risk normal,
descriptor FILEWELL). The filing is **DAFF TRUCKING LLC**: test data. Never file it with
Pennsylvania unless you independently confirm you are authorized to act for that company.

**Refund and close it (owner, about 3 minutes):**
1. https://www.getfilewell.com/admin → open the DAFF TRUCKING LLC filing (or
   `/admin/filings/cbe14de5-c4a4-4d55-a7d0-f7775d321ec2`). Do **not** click Mark ready to
   file, Start filing or Open official filing site.
2. **Cancel filing** → Reason: `Owner payment test, not a real filing` → confirm. The
   filing becomes Cancelled (it can no longer be filed) and you get a "Cancelled" email.
3. **Refund (admin)** → leave the defaults (Government fee `7.00`, Service fee `49.00`) →
   Reason: `Owner payment test` → **Issue refund** → confirm.
4. Check: the filing shows **Refunded**; `/admin/payments` shows the order refunded
   $56.00; Stripe → Payments → the $56.00 payment shows Refunded; you get "Refund issued"
   from Filewell and Stripe's refund receipt. Stripe keeps its processing fee on a refund.
5. Optional: on your dashboard, archive the DAFF TRUCKING LLC business (or mark the report
   filed elsewhere) so overdue reminders for it stop.

**Timestamps:** Filewell shows every time in Eastern with the zone (9:16 PM EDT, Sep 30).
Stripe's receipt showed Oct 1, 1:16 AM because the Stripe account's time zone is
`Etc/UTC` (same instant). Fix in Stripe: Settings → Business → Account details → Time
zone → Eastern Time (US & Canada). Past receipts keep the old rendering; stored timestamps
are unchanged.

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
- Search indexing (only with your written approval; OPERATIONS.md). Gates: test order
  refunded and closed; governing law set; legal pages reviewed by an attorney (or your
  recorded decision to index without it); first real customer filed end to end; then
  your written go-ahead to set `NEXT_PUBLIC_ALLOW_INDEXING=true` on Production.
