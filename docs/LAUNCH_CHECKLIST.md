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

Observed 2026-09-29 (read-only checks of Vercel and Supabase):

- Production Supabase `tnwpcprvetxtgyjuncrl` (filewell-production, Pro org, us-east-1):
  migrations 000001 to 000006 applied; reference data present (51 states, 8 PA rules,
  reminder schedule, one provisional $49 PA price, **not approved**); private
  `filing-documents` bucket; 0 users, 0 staff, 0 orders. `notification_templates` is
  empty at first; **filled later on 2026-09-29** (all 15 templates, identical to staging),
  and migration 000007 applied to both projects.
- Vercel Production still points `NEXT_PUBLIC_SUPABASE_URL` / keys at **staging**
  (`iskphxoowsiuvvojswty`), and has `EMAIL_PROVIDER=outbox`, `PAYMENTS_PROVIDER=sandbox`
  and `SANDBOX_WEBHOOK_SECRET`. `RESEND_API_KEY` is set on Production **and Preview**.
  `NEXT_PUBLIC_SITE_URL=https://www.getfilewell.com`, `EMAIL_FROM` and `EMAIL_REPLY_TO`
  are set on Production.
- DNS: getfilewell.com is verified in Resend; it has **no MX record**, so mail to
  support@getfilewell.com bounces.

## 1. Infrastructure and data

| Status | Item | Ids |
| --- | --- | --- |
| PASS | Production Supabase project created in the Pro org (daily backups, no auto-pause); migrations applied | g1-integrity-02, critic-06 |
| PASS | Reference data and all 15 notification templates seeded | g1-integrity-12 |
| BLOCKED | Vercel **Production-only** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` set to the production project; staging values kept on Preview/Development; redeploy | g1-integrity-02, g3-email-08 |
| BLOCKED | Production-only secrets: new `APP_SIGNING_SECRET`, `IP_HASH_SALT`, `CRON_SECRET`; remove `SANDBOX_WEBHOOK_SECRET` and the Preview target of `RESEND_API_KEY` | critic-02 |
| BLOCKED | Supabase Auth on the production project: Site URL, redirect URLs, confirmations, password policy, leaked-password check and branded subjects are **done**; custom SMTP (needs a Resend API key) and optional template bodies remain | g1-integrity-03, g2-email-10, g3-email-04, g3-email-06, critic-03 |
| BLOCKED | Owner signs up at https://www.getfilewell.com and is granted admin (`grant-staff` with `CONFIRM_PRODUCTION`); no test users or staff in production | g7-ops-01, g4-5-pay-price-08, g1-integrity-09 |
| BLOCKED | Vercel plan allows commercial use (Pro) | g1-integrity-21 |
| BLOCKED | GitHub repo visibility decided; 2FA on GitHub, Vercel, Supabase, Stripe, registrar/DNS; branch protection on `main`; Vercel Git Fork Protection on | critic-01 |
| PASS | Scripts refuse the production project unless `CONFIRM_PRODUCTION` names it. E2E never uses the production project, and against a production host only `tests/e2e/public.spec.ts` runs. Production credentials never in `.env.local` | g1-integrity-10, g1-integrity-11 |
| PASS | `*.vercel.app` production aliases redirect to the canonical domain; production links always use https://www.getfilewell.com | g1-integrity-07, g2-domain-08, g3-email-05, g9-seo-05 |

## 2. Email

| Status | Item | Ids |
| --- | --- | --- |
| PASS | getfilewell.com verified in Resend; `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` set on Production | g2-email-11, g3-email-03 |
| BLOCKED | Production `EMAIL_PROVIDER` changed from `outbox` to `resend` (or removed), after the Supabase switch above; redeploy | g3-email-03, g3-email-08, g6-legal-25 |
| BLOCKED | Inbound mail: MX / forwarding for support@ (and dmarc@, billing@) on getfilewell.com, monitored by a named person | g2-brand-02, g6-legal-01, g3-email-12 |
| BLOCKED | DMARC TXT at `_dmarc.getfilewell.com`; Resend open/click tracking off | g3-email-03 |
| BLOCKED | Verification: real signup + password reset from an outside address, one owner order; Gmail "Show original" shows SPF, DKIM, DMARC = PASS; `/admin/notifications` shows provider `resend` | g3-email-16 |
| BLOCKED | Postal address for email footers (`NEXT_PUBLIC_POSTAL_ADDRESS`); counsel says whether reminders are commercial | g3-email-15, g6-legal-26 |
| PASS | Resend delivers only on production; misconfiguration fails visibly; test-domain recipients blocked; operator messages reflect the real send result | g2-email-12, g3-email-02, g3-email-07, g3-email-09, g7-ops-07 |

## 3. Payments and price

| Status | Item | Ids |
| --- | --- | --- |
| PASS | No real charge is possible today; state fee and service fee are separate lines; no PA late fee is claimed | g4-5-pay-price-01, g4-5-pay-price-09, g4-5-pay-price-11 |
| PASS | Production refuses the sandbox and Stripe test keys; until Stripe is live, production checkout says payments are unavailable | g1-integrity-04, g4-5-pay-price-02, g6-legal-27 |
| BLOCKED | Stripe account for this business: verification, public details, statement descriptor, receipts, instant payment methods only, Radar and dispute alerts | g4-5-pay-price-16, g2-brand-23, critic-07 |
| BLOCKED | Stripe test-mode purchase and refund run end to end off production (local Stripe CLI) | g1-integrity-19 |
| BLOCKED | Sales-tax determination for the service fee | g4-5-pay-price-16 |
| BLOCKED | Owner sets and approves the final PA service fee in `/admin/pricing` | g4-5-pay-price-08, g1-integrity-05 |
| BLOCKED | Live keys, webhook secret, `PAYMENTS_PROVIDER=stripe`, `PAYMENTS_LIVE_ENABLED=true` on the Production target only, never "All environments" (owner approval) | g1-integrity-19 |
| PASS | `ALLOW_TEST_PAYMENTS_IN_PRODUCTION`, `ALLOW_SANDBOX_IN_PRODUCTION` (older name, no longer honored since `06d7581`) and `ALLOW_REAL_PAYMENTS_IN_TESTS` are set on no Vercel target (env names checked 2026-09-29, values not read). Keep it that way | g1-integrity-04 |

## 4. Legal

| Status | Item | Ids |
| --- | --- | --- |
| PASS | All legal pages are marked "Draft for legal review"; nothing implies attorney review; the not-a-government-agency disclosure is on every selling page | g6-legal-07, g6-legal-28 |
| PASS | Legal copy matches the product: processors named, cookies, IP logs, data collected, how to cancel, account closure, authorization signed on Review before payment, "Filing supported" label, draft banner wording | g6-legal-02, g6-legal-06, g6-legal-12 to g6-legal-15, g6-legal-17, g6-legal-18, g6-legal-21, g6-legal-22 |
| PASS | Authorization text v2 ("the amount I pay for this order") and agreement to the Terms and Refund Policy with their date, stored with each signature; checkbox covers the full text; the version follows the legal documents' date | g6-legal-08, g6-legal-09, g6-legal-20 |
| PASS | Signed text names the legal name being filed (the intake answer), not the name typed at lookup, both in `authorizeFiling` and on the Review page | g6-legal-19 |
| BLOCKED | Owner decision, recorded with the document date: take the first paid order under unreviewed draft terms, or get attorney review first | g6-legal-05, g2-legal-21 |
| BLOCKED | Legal entity name (`NEXT_PUBLIC_LEGAL_ENTITY`), state of formation, governing law and disputes clause, postal address, support reply time, PA fee-refund wording, retention periods | g2-legal-05, g6-legal-04, g4-5-pay-price-22, g6-legal-16 |
| BLOCKED | Counsel confirms the service may e-sign the PA report as authorized representative, and the exact signer name and title | g6-legal-11, g2-legal-07 |

## 5. Operations

| Status | Item | Ids |
| --- | --- | --- |
| BLOCKED | Company Business Filing Services login at file.dos.pa.gov and a company card for the $7 state fee | g7-ops-08 |
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
