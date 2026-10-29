# Business services: registered agent, bundle, formation

Status (Oct 29, 2026): **built, not launched.** Nothing here changes what production sells
today. Merging this code leaves production exactly as it is: the annual report stays at its
current $49 price, the new public pages return 404 on production, and every new checkout is
refused until the switches below are set and the gates are cleared.

The legal entity is meant to be Harborlune LLC, whose Texas formation is **pending (not
formed)**. Production keeps its current legal entity, payment account and disclosures until
the transition checklist at the end of this page is done.

## Prices (approved for configuration and testing, not activated)

All prices live in `service_prices` rows (seeded unapproved). Live checkout refuses any row
an admin has not approved in `/admin/pricing`, so a price reaches real customers only by an
explicit approval.

| Service | Price | Notes |
|---|---|---|
| Registered agent | $119 per business, per state, per year | Same price at renewal |
| Switching agents | State fee only | Filewell absorbs the provider's $25 change charge, tracked as acquisition cost (`CHANGE_OF_AGENT_ABSORBED_CENTS`) |
| Registered agent + annual report bundle | $169 per year, plus the state's report fee | Only in PA, CO, FL, SD, MT, MI; not advertised until `RA_BUNDLE_SALES=true` |
| Formation | $99 plus the state fee | Registered agent is an optional add-on ($119), never included automatically |
| Annual report | $49 in production; $79 configured as variant `proposed_79` | Charged only when `ANNUAL_REPORT_PRICE_VARIANT=proposed_79` and the $79 rows are approved |
| Additional regular mail | $15 per item | Beyond the included items; built as a catalog entry, charging not built |

Wholesale rates used for economics (Registered Agents Inc., as quoted and as written in the
unsigned agreement): registered agent $45/entity/state/year; formation, annual report and
amendments $75 plus state fee; change of agent $25 plus state fee; extra regular mail $15 per
item. Good standing ($50) and EIN ($25 with SSN, $100 without) are **not in the agreement**,
so those services stay disabled (`not_offered` in `src/lib/services/catalog.ts`).

Planning estimates (estimated 2.9% + 30¢ card fee) are on `/admin/economics`. Example:
registered agent at $119 with $45 wholesale and a $3.75 estimated card fee contributes $70.25.

## Launch gates

A registered agent sale is possible in a jurisdiction only when **all** of these hold. The
code enforces each one (`src/lib/registered-agent/sales.ts`); `/admin/registered-agent` lists
what is still missing per jurisdiction.

1. The wholesale Service Agreement is signed, then `RA_PROVIDER_AGREEMENT_SIGNED=true`.
2. The provider's coverage of the jurisdiction is confirmed in writing (today every
   jurisdiction is only "listed in the provider's guide"; update `providerCoverage`).
3. An operator has completed one test order path with the provider for the jurisdiction
   (set `fulfillmentReady: true`).
4. For switching: the state's change-of-agent fee is verified from an official source for that
   entity type. For new entities: how the new entity names its agent is verified.
5. `RA_SALES_<CODE>=true` for the jurisdiction.
6. The prices involved are approved in `/admin/pricing`.
7. The Stripe webhook endpoint sends `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.updated` and `customer.subscription.deleted`.
8. `BUSINESS_SERVICES_PAGES=true` (public pages and the dashboard entry point on production).
9. The legal drafts in `docs/legal-drafts/` are reviewed by a professional and published.

Outside production (sandbox or Stripe test mode), only gate 5 and a verified fee are needed,
so the whole journey can be tested end to end without real money.

## Environment switches (all off unless exactly "true")

| Variable | Effect |
|---|---|
| `RA_PROVIDER_AGREEMENT_SIGNED` | Owner sets it once the agreement is signed |
| `RA_SALES_<CODE>` | Opens registered agent checkout in one jurisdiction |
| `RA_BUNDLE_SALES` | Allows the bundle (bundle states only) |
| `FORMATION_SALES_<CODE>` | Opens formation in one state (none can open: no fee verified) |
| `BUSINESS_SERVICES_PAGES` | Shows public pages on production and lets search engines index them |
| `ANNUAL_REPORT_PRICE_VARIANT` | `standard` (default) or `proposed_79` |
| `CHANGE_OF_AGENT_ABSORBED_CENTS` | Absorbed change cost for economics (default 2500) |

## Coverage (52 jurisdictions)

`src/lib/registered-agent/jurisdictions.ts` has one record for each state, DC and Puerto
Rico, with: provider coverage, appointment process, change-of-agent form and fee by entity
type, consent requirement, formation fee, resignation fee, filing requirements, provider
notes, refund notes, fulfillment readiness and blockers. A field is a fact only with an
official source and a check date; everything else is `null` and blocks the sale.

Verified Oct 29, 2026 from state sites (change of registered agent fee):

| State | LLC | Corporation | Notes |
|---|---|---|---|
| Texas | $15 | $15 | Form 401; new agent's consent required |
| Florida | $25 | not verified | Corporations can't be sold until verified |
| Colorado | $10 | $10 | Online filing |
| South Dakota | $10 | $10 | |
| Michigan | $5 | $5 | Form CSCL/CD 520 |
| Montana | $0 | $0 | |
| Pennsylvania | $5 | $5 | Blocked: Pennsylvania uses Commercial Registered Office Providers; the provider's PA status was not checked |

Everything else: **not verified**, so not sold. Puerto Rico is not researched. Wyoming needs
beneficial ownership intake for the provider, which is not built. No state's formation fee or
new-entity appointment process is verified, so formation is not sellable anywhere and the
"starting a business" registered agent path is blocked for real money.

Public state pages exist only for the six jurisdictions with verified, sellable change facts
(TX, FL, CO, SD, MI, MT). There are no pages for the rest (no thin pages).

### Pennsylvania check (against the notes)

The code matches the notes: Pennsylvania's annual report is live by default, and CO, FL, SD,
MT and MI open by their `<CODE>_LIVE_FILING_SALES` switches. These six are the bundle states.
For registered agent service Pennsylvania is different: it has no "registered agent" in the
usual sense but Commercial Registered Office Providers (CROPs). Until the provider confirms it
is a Pennsylvania CROP and how it is named, PA registered agent sales stay blocked.

## How an order flows

1. The customer starts at `/registered-agent` or from their business page
   (`/dashboard/services/new?business=…`), picks "already have a business" (switching) or
   "starting a business", and the plan.
2. They give the business's communications contact: a real person, a physical address (no PO
   box) and a phone number. The provider can ask for these with 12 hours to answer.
3. Checkout shows the service charge, government fee, add-ons, renewal price and total due
   today on separate lines, plus the renewal and cancellation terms they must tick.
4. Stripe Checkout runs in subscription mode: the yearly line renews, one-time lines (state
   fees) are charged once. A $0 line (the included change filing) stays on our order but is
   not sent to Stripe.
5. The webhook marks the order paid, links the Stripe subscription, sets billing to active and
   moves each provider order to **Payment confirmed**. Never further.
6. Operators work the order in `/admin/registered-agent`:
   Payment confirmed → (Information needed) → Ready for provider → Submitted to provider
   (provider order number required) → Processing → **Active** (appointment) or **Completed**
   (change or formation filing). Active and Completed need a confirmation date and evidence
   (the provider's confirmation, or the state record and the date you checked it). The
   database refuses anything else.
7. The customer is emailed at Active (and at Completed for the change filing).

## Documents and escalation

- Upload in the subscription page (`/admin/registered-agent/<id>`): PDF, PNG or JPEG, private
  bucket, unguessable path, row-level security on reads, 60-second signed download links,
  every download audited.
- The customer is emailed at once. The provider emails only Filewell's account address and
  never the customer, so Filewell must watch that inbox (or the provider's dashboard) and
  upload promptly.
- Service of process is **urgent**, government notices **high**, everything else normal.
- Internal targets (never shown to customers): urgent documents escalate to the backup
  operator after 2 hours and to the owner after 4 hours without a confirmed customer
  notification; high after 24 and 48 hours. For urgent documents, also call the customer and
  record the attempt.
- The provider's own upload is "typically within 24 hours" with no guarantee (agreement as
  reviewed, unsigned). Customer copy promises no delivery time. If a time is ever published,
  it must not be faster than one business day.
- Regular mail: 3 items per client per service year are included by the provider, then $15
  each (unsigned terms). Packages are refused or held 12 days; physical copies only within
  50 days; no online-service verification cards.

## Renewals, failed payments and cancellation

Billing and the legal appointment are separate states and never move each other.

- Reminders go 30 and 7 days before renewal (daily cron).
- A failed renewal: the customer is emailed, Stripe retries, and after 3 failures (or
  "unpaid") staff get a review alert. Service is never ended because of a failed payment.
- Turning off renewal (`cancel_at_period_end`) keeps service until the paid year ends. The
  email tells the customer to name a new agent and not to set up USPS forwarding from the
  agent's address.
- A subscription that ends only creates an operator review. Before asking the provider to end
  service, record the customer's replacement agent. Then Cancellation requested → Provider
  termination pending → Terminated (with the provider's confirmation).
- The provider renews each entity on its own yearly date and must be told 30 days before to
  cancel. Record the provider renewal date on each subscription; from 40 days before it, unpaid
  entities are flagged to staff to cancel in the partner dashboard.

## Bundle rules

- The billing anniversary and the state's due date are modelled separately.
- Each bundle year includes exactly one annual report: the earliest open report due inside
  that year. A business with no report due in the first year can't buy the bundle.
- The state report fee is never charged on the anniversary. It is charged when the customer
  authorizes that year's filing, through the normal annual report checkout with Filewell's
  service fee at $0.
- A reporting year and a requirement can be in only one live bundle year, and a requirement
  can have only one active filing (database unique indexes), so nothing is filed twice.

## Business continuity

- Either side can end the agreement on 6 months' written notice; "reasonable transition
  services" are undefined. Keep the provider abstraction (`RegisteredAgentProvider`) so a
  second provider can be added, and keep all customer and document data in Filewell (the
  agreement says customer data is Filewell's, with no export format).
- Termination and transition stay manual: there is no automatic termination path in the code.
- Before signing, see the open questions in the agreement review (shared project files,
  `filewell/rai-service-agreement-review-2026-10-29.md`).

## Scheduled jobs

- `GET /api/cron/reminders` (daily, existing) also runs the registered agent checks.
- `GET /api/cron/services` runs the same checks and is safe hourly. Once anything is sold,
  schedule it hourly (Vercel Pro cron or an external scheduler with `CRON_SECRET`) so urgent
  documents escalate on time.

## Harborlune LLC transition checklist

Do none of these until Harborlune LLC is formed and the owner decides to switch.

1. Texas approves the formation; keep the certificate on file.
2. The agreement is signed by Harborlune LLC (not by an individual), Exhibit A questions are
   settled, then set `RA_PROVIDER_AGREEMENT_SIGNED=true`.
3. Stripe account ownership and payout bank account move to Harborlune (owner, in Stripe).
4. Set `NEXT_PUBLIC_LEGAL_ENTITY=Harborlune LLC` (it drives the footer, legal pages and the
   filing agent name) on the Production target and redeploy.
5. Publish the reviewed legal pages naming Harborlune LLC.
6. Sales tax registration where required (not researched).

## Post-launch work (not built)

- Charging for extra regular mail.
- Formation checkout (needs verified state fees and appointment steps per state).
- Amendments, good standing, reinstatement, EIN: flagged, not built.
- A provider API adapter (manual dashboard today).
- Wyoming beneficial ownership intake.
