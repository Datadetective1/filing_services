# Launch checklist: first paid Pennsylvania customer

Scope: accept and fulfil one real paid Pennsylvania annual report on
https://www.getfilewell.com, safely. Finding ids refer to the launch audit (2026-09-29).
Runbooks for every step are in [OPERATIONS.md, "Production"](OPERATIONS.md#production).

Status: **PASS** = done or verified. **BLOCKED** = needs the owner (or counsel); the
engineer cannot do it. The engineering fixes from the launch sprint (PR #2, merged as
`06d7581` and deployed to production on 2026-09-29) are all marked PASS: they passed the
build, 414 unit and DB tests, the Playwright journey on staging and on a Vercel preview,
`tests/e2e/public.spec.ts` against https://www.getfilewell.com, and a 25-point read-only
production check. See [FIRST_CUSTOMER_READINESS.md](FIRST_CUSTOMER_READINESS.md).

Observed 2026-09-30 (re-audit of live Vercel env names/targets, Supabase auth settings,
DNS, production database and the live site; details in
[FIRST_CUSTOMER_READINESS.md](FIRST_CUSTOMER_READINESS.md) section 2):

- Production reads and writes `tnwpcprvetxtgyjuncrl` (filewell-production) with matching
  keys; Preview and Development use staging. 0 users, 0 orders, 0 staff in production.
- Supabase Auth production settings verified; SMTP port corrected from 572 to 587.
- Email: `EMAIL_PROVIDER=resend` on Production; Cloudflare Email Routing MX present; DKIM
  and Resend SPF present; **duplicate DMARC** and a root SPF without Cloudflare's include
  remain (owner).
- Payments: `PAYMENTS_PROVIDER=sandbox`, `PAYMENTS_LIVE_ENABLED=false`; production refuses
  the sandbox, so checkout is closed. Indexing off.

## 1. Infrastructure and data

| Status | Item | Ids |
| --- | --- | --- |
| PASS | Production Supabase project created in the Pro org (daily backups, no auto-pause); migrations applied | g1-integrity-02, critic-06 |
| PASS | Reference data and all 15 notification templates seeded | g1-integrity-12 |
| PASS | Vercel Production reads filewell-production: Production-only URL and publishable key, `SUPABASE_SERVICE_ROLE_KEY` (staging `SUPABASE_SECRET_KEY` scoped to Preview); Preview/Development on staging; verified by a live write and the /admin "Database keys" check (fixed 2026-09-30) | g1-integrity-02, g3-email-08 |
| BLOCKED | Production-only secrets: new `APP_SIGNING_SECRET`, `IP_HASH_SALT`, `CRON_SECRET`; remove `SANDBOX_WEBHOOK_SECRET` and the Preview target of `RESEND_API_KEY` | critic-02 |
| PASS | Supabase Auth on the production project: Site URL, redirects (www + apex), confirmations, password policy, leaked-password check, branded subjects, custom SMTP via Resend on port 587 (was saved as 572; corrected 2026-09-30), 30 emails/hour. Optional: branded template bodies | g1-integrity-03, g2-email-10, g3-email-04, g3-email-06 |
| PASS | Owner signed up at https://www.getfilewell.com, confirmed, tested sign-in and password reset, and was granted admin (owner-verified 2026-09-30) | g7-ops-01, g4-5-pay-price-08, g1-integrity-09 |
| PASS | Vercel plan allows commercial use (Pro) | g1-integrity-21 |
| BLOCKED | GitHub repo visibility decided; 2FA on GitHub, Vercel, Supabase, Stripe, registrar/DNS; branch protection on `main`; Vercel Git Fork Protection on | critic-01 |
| PASS | Scripts refuse the production project unless `CONFIRM_PRODUCTION` names it. E2E never uses the production project, and against a production host only `tests/e2e/public.spec.ts` runs. Production credentials never in `.env.local` | g1-integrity-10, g1-integrity-11 |
| PASS | `*.vercel.app` production aliases redirect to the canonical domain; production links always use https://www.getfilewell.com | g1-integrity-07, g2-domain-08, g3-email-05, g9-seo-05 |

## 2. Email

| Status | Item | Ids |
| --- | --- | --- |
| PASS | getfilewell.com verified in Resend; `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` set on Production | g2-email-11, g3-email-03 |
| PASS | Production `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` Production-only, `EMAIL_FROM`/`EMAIL_REPLY_TO` set; first real delivery still to be observed (READINESS 4.5) | g3-email-03, g3-email-08, g6-legal-25 |
| PASS | Inbound mail: Cloudflare Email Routing MX on getfilewell.com; support@, filings@, billing@ forwarded (owner-confirmed) | g2-brand-02, g6-legal-01, g3-email-12 |
| PASS | DNS: one DMARC record (p=none, rua), root SPF includes Cloudflare Email Routing; SPF/DKIM/DMARC pass (verified 2026-09-30) | g3-email-03 |
| PASS | Real signup, confirmation, reset and a production app email (Resend, `filings@` with Reply-To `support@`, reply routed back via Cloudflare) verified 2026-09-30; `/admin/notifications` shows `resend` / `sent` | g3-email-16 |
| BLOCKED | Postal address for email footers (`NEXT_PUBLIC_POSTAL_ADDRESS`); counsel says whether reminders are commercial | g3-email-15, g6-legal-26 |
| PASS | Resend delivers only on production; misconfiguration fails visibly; test-domain recipients blocked; operator messages reflect the real send result | g2-email-12, g3-email-02, g3-email-07, g3-email-09, g7-ops-07 |

## 3. Payments and price

| Status | Item | Ids |
| --- | --- | --- |
| PASS | No real charge is possible today; state fee and service fee are separate lines; no PA late fee is claimed | g4-5-pay-price-01, g4-5-pay-price-09, g4-5-pay-price-11 |
| PASS | Production refuses the sandbox and Stripe test keys; until Stripe is live, production checkout says payments are unavailable | g1-integrity-04, g4-5-pay-price-02, g6-legal-27 |
| BLOCKED | Stripe live account `acct_1ULCTn0kBic3wOhx`: charges + payouts enabled, descriptor FILEWELL, MCC 7399, card + Link only (enforced in code). **Past due:** bank account and identity-verification challenge; public support email empty | g4-5-pay-price-16, g2-brand-23, critic-07 |
| PASS | Checkout verified without money moving: a live session with the production parameters ($49 + $7 = $56, card + Link, www URLs) was accepted by Stripe and expired unpaid; sandbox journey (pay, duplicate/forged webhooks, file, refund paths) 21/21 E2E on staging (2026-09-30) | g1-integrity-19 |
| BLOCKED | Sales-tax determination for the service fee | g4-5-pay-price-16 |
| PASS | PA service fee $49.00 approved (owner's written approval, recorded with an audit row 2026-09-30) | g4-5-pay-price-08, g1-integrity-05 |
| BLOCKED | Live webhook endpoint created (`we_1ULElQ0kBic3wOhxnXQTsnHJ`, 6 events, API 2026-08-26.dahlia); `PAYMENTS_PROVIDER=stripe` and `PAYMENTS_LIVE_ENABLED=false` on Production only. Owner adds `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (Production, Sensitive), then flips `PAYMENTS_LIVE_ENABLED` after the controlled test | g1-integrity-19 |
| PASS | `ALLOW_TEST_PAYMENTS_IN_PRODUCTION`, `ALLOW_SANDBOX_IN_PRODUCTION` (older name, no longer honored since `06d7581`) and `ALLOW_REAL_PAYMENTS_IN_TESTS` are set on no Vercel target (env names checked 2026-09-29, values not read). Keep it that way | g1-integrity-04 |

## 4. Legal

| Status | Item | Ids |
| --- | --- | --- |
| PASS | All legal pages are marked "Draft for legal review"; nothing implies attorney review; the not-a-government-agency disclosure is on every selling page | g6-legal-07, g6-legal-28 |
| PASS | Legal copy matches the product: processors named, cookies, IP logs, data collected, how to cancel, account closure, authorization signed on Review before payment, "Filing supported" label, draft banner wording | g6-legal-02, g6-legal-06, g6-legal-12 to g6-legal-15, g6-legal-17, g6-legal-18, g6-legal-21, g6-legal-22 |
| PASS | Authorization text v2 ("the amount I pay for this order") and agreement to the Terms and Refund Policy with their date, stored with each signature; checkbox covers the full text; the version follows the legal documents' date | g6-legal-08, g6-legal-09, g6-legal-20 |
| PASS | Signed text names the legal name being filed (the intake answer), not the name typed at lookup, both in `authorizeFiling` and on the Review page | g6-legal-19 |
| BLOCKED | Owner decision, recorded with the document date: take the first paid order under unreviewed draft terms, or get attorney review first | g6-legal-05, g2-legal-21 |
| BLOCKED | Operator set (`NEXT_PUBLIC_LEGAL_ENTITY=Amary Coulibaly, sole proprietor`); retention, reply time, PA fee-refund wording and disputes placeholders resolved without inventing facts. Still open: governing-law state (`NEXT_PUBLIC_GOVERNING_LAW`), public postal address (optional; legal pages say "available on request") | g2-legal-05, g6-legal-0 |
| BLOCKED | Counsel confirms the service may e-sign the PA report as authorized representative, and the exact signer name and title | g6-legal-11, g2-legal-07 |

## 5. Operations

| Status | Item | Ids |
| --- | --- | --- |
| PASS | Owner has a Business Filing Services login at file.dos.pa.gov and funds for the $7 state fee (owner-confirmed 2026-09-30) | g7-ops-08 |
| PASS | Operator guards and visibility: sandbox orders labelled, "ready to file" checks, refunds owed stay visible, customer messages surfaced, staff alerts | g1-integrity-08, g7-ops-03 to g7-ops-06, g7-ops-12, g7-ops-13, g3-email-13 |
| PASS | Incident, rollback, backup and export basics documented | critic-06 |
| BLOCKED | Before Jan 1, 2027: confirm whether PA accepts a 2026 report after Dec 31 | g8-deadline-14 |

## 6. Search indexing (not needed for the first customer)

| Status | Item | Ids |
| --- | --- | --- |
| PASS | Indexing is off everywhere; robots.txt disallows all; a unit test guards it (`tests/unit/seo-indexing.test.ts`) | g9-seo-01, g9-seo-18 |
| PASS | Auth pages noindex; `/help` JSON-LD valid | g9-seo-06, g9-seo-11 |
| PASS | Nonprofit meta description uses `stateFeeSentence` (no more "State fee: No state fee.") | g9-seo-15 |
| BLOCKED | Owner's written approval, then the procedure in OPERATIONS.md ("Turning on indexing") | g9-seo-17, g9-seo-20 |

## Go / no-go for the first paid order

All of these must be true:

1. Production reads and writes `tnwpcprvetxtgyjuncrl`, not staging.
2. Supabase Auth emails deliver from getfilewell.com and links land on https://www.getfilewell.com/auth/confirm.
3. App emails deliver through Resend (`EMAIL_PROVIDER` is not `outbox` on Production).
4. support@getfilewell.com receives mail and someone reads it.
5. The owner is the only admin, the service fee is approved, and Stripe live payments are on.
6. The owner has recorded the decision about draft legal terms (g6-legal-05).
7. The operator has a PA filing login, a card for the state fee and counsel-approved signature wording.
