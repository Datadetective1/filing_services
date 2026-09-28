# Filewell

Self-service U.S. business compliance filings, starting with **Pennsylvania annual
reports**. Customers find their business, see what's required, when it's due and what
it costs (state fee and service fee shown separately), authorize us, pay through hosted
checkout, and track the filing to completion. Operators fulfil each order from a
generated filing packet.

> Filewell is a private filing service. It is not affiliated with or endorsed by any
> government agency, and customers can always file directly with their state.

- Architecture and conventions: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Operator runbook (manual Pennsylvania filing): [docs/OPERATIONS.md](docs/OPERATIONS.md)
- Launch checklist: [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md)
- Official-source research + verification log: [docs/research/](docs/research/)

## Local development

Requirements: Node 24, Docker Desktop (for the local Supabase stack).

```bash
npm install
cp .env.example .env.local        # then fill in values
npx supabase start                # local Postgres, Auth, Storage, Mailpit (emails at http://127.0.0.1:54324)
npx supabase db reset             # applies supabase/migrations
npm run seed                      # states, agencies, PA rules, provisional price, templates
npm run dev
```

`npx supabase status` prints the local URL and keys for `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`).

Create an operator: sign up through the app, then

```bash
npm run grant-staff -- you@example.com admin
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit + database tests (Vitest; database tests run the real migrations in PGlite, no Docker needed) |
| `npm run test:e2e` | Playwright end-to-end journey (needs a running app + Supabase) |
| `npm run seed` | Idempotent reference-data seed (refuses to alter a published rule version) |
| `npm run grant-staff -- <email> <admin\|operator\|revoke>` | Staff access |

## End-to-end tests

The Playwright suite drives the full Pennsylvania journey (visitor → lookup → account
→ intake → authorization → sandbox payment → operator queue → packet → submitted →
receipt → accepted → customer notified → reminders stop) plus cross-account attacks
and webhook forgery. It needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in
`.env.local` (test users are created with the service role).

```bash
npm run build && npm run test:e2e                      # local production build
E2E_BASE_URL=https://<deployment>.vercel.app \
E2E_SHARE_URL="https://<deployment>.vercel.app/?_vercel_share=<token>" \
npm run test:e2e                                       # a protected Vercel deployment
```

`E2E_SHARE_URL` is a temporary Vercel share link (Vercel MCP `get_access_to_vercel_url`
or the dashboard's "Share" button); the global setup visits it once and reuses the
access cookie.

## Payments

`PAYMENTS_PROVIDER=sandbox` (default) uses the built-in hosted-checkout simulator:
no card fields, no money, signed webhooks through the same processing path as Stripe.
`PAYMENTS_PROVIDER=stripe` uses Stripe Checkout. Live keys are refused unless
`PAYMENTS_LIVE_ENABLED=true`, and live checkout refuses service prices an admin has not
approved in `/admin/pricing`.

Stripe webhook endpoint: `POST /api/webhooks/payments/stripe` (events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`payment_intent.payment_failed`, `refund.created`, `refund.updated`).

## Email

`EMAIL_PROVIDER=outbox` records every email in the `notifications` table (visible at
`/admin/notifications`) without sending. `EMAIL_PROVIDER=resend` sends through Resend
from `EMAIL_FROM` (requires a verified sending domain for this product).

## Reminders

`vercel.json` schedules `GET /api/cron/reminders` daily at 13:00 UTC with
`Authorization: Bearer $CRON_SECRET`. Operators can also run a cycle from
`/admin/reminders`.

## Adding a state

1. Research the rules from official sources only; record URL, verbatim quote and date.
2. Add `src/lib/compliance/states/<state>.ts` exporting `ComplianceRuleDef[]` with
   `verificationStatus: "verified"` only after independent verification.
3. Register it in `src/lib/compliance/registry.ts`, set `supportLevel` and
   `filingEnabled` in `jurisdictions.ts`, add a service price, run `npm run seed`.
4. To change an existing rule, add a new `version` with a new `effectiveFrom`.
   Published versions are immutable; existing orders keep the version they used.
