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

A sale is possible in a jurisdiction only when **all** of these hold. The code enforces each
one (`src/lib/registered-agent/sales.ts`); `/admin/registered-agent` lists what is still
missing per jurisdiction.

Nationwide, once:

1. The wholesale Service Agreement is signed, then `RA_PROVIDER_AGREEMENT_SIGNED=true`.
2. One end-to-end test order with the provider succeeds, then `RA_FULFILLMENT_TESTED=true`.
   The workflow is the same in every jurisdiction (only the facts differ), so one test covers
   all of them.
3. The prices involved are approved in `/admin/pricing`.
4. The live Stripe webhook endpoint (`we_1ULElQ0kBic3wOhxnXQTsnHJ`) also sends
   `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated` and
   `customer.subscription.deleted`. The admin status panel checks this.
5. `BUSINESS_SERVICES_PAGES=true` (public pages and the dashboard entry points on production).
6. `NEXT_PUBLIC_LEGAL_ENTITY` names a company (Harborlune LLC once formed). Customers never
   contract with a person; a personal name such as a sole proprietor blocks every sale.
7. A Filewell alerts mailbox (for example `alerts@getfilewell.com`, a free Zoho alias) is added
   as a second notification email on the provider's master account, then
   `RA_ALERTS_MAILBOX=<that address>`. The provider only emails the master account, never the
   customer, so Filewell must receive every alert itself.

Per jurisdiction (already done where the coverage table says "Verified, ready"):

8. The provider lists the jurisdiction (its own state page, recorded with a quote).
9. For switching: the state's change-of-agent fee is verified for that entity type. For a new
   business: how the business names its agent at formation is verified. For formation: the
   formation fee is verified and nothing else is owed at formation (see Coverage).
10. The switch is on: `RA_SALES_ALL=true` (or `RA_SALES_<CODE>=true` for one jurisdiction),
   and `FORMATION_SALES_ALL=true` (or `FORMATION_SALES_<CODE>=true`) for formation.

The `ALL` switches never open a jurisdiction with a missing fact: every check still runs per
jurisdiction, entity type and path. After gates 1 to 7, opening every verified jurisdiction is
one step.

Outside production (sandbox or Stripe test mode), only the switch and a verified fee are
needed, so the whole journey can be tested end to end without real money.

## Environment switches (all off unless exactly "true")

| Variable | Effect |
|---|---|
| `RA_PROVIDER_AGREEMENT_SIGNED` | Owner sets it once the agreement is signed |
| `RA_FULFILLMENT_TESTED` | Owner sets it after the first end-to-end provider test order |
| `RA_SALES_ALL` | Opens registered agent checkout in every verified jurisdiction |
| `RA_SALES_<CODE>` | Opens registered agent checkout in one jurisdiction |
| `RA_BUNDLE_SALES` | Allows the bundle (bundle states only) |
| `FORMATION_SALES_ALL` | Opens formation in every state with a verified fee |
| `FORMATION_SALES_<CODE>` | Opens formation in one state |
| `BUSINESS_SERVICES_PAGES` | Shows public pages on production and lets search engines index them |
| `RA_ALERTS_MAILBOX` | Filewell's alerts mailbox registered on the provider account (an address, not "true") |
| `ANNUAL_REPORT_PRICE_VARIANT` | `standard` (default) or `proposed_79` |
| `CHANGE_OF_AGENT_ABSORBED_CENTS` | Absorbed change cost for economics (default 2500) |

## Customer terms

Customers agree to `/legal/business-services` at checkout (the registered agent consent box,
and "By paying, you agree" on formation). The owner chose to publish these terms as written,
without attorney review for now, so they carry no draft banner. They never promise more than
the provider promises Filewell:

- No delivery time. Documents "usually" reach the customer within one business day after
  they reach us; weekends and US federal holidays are not handled. The provider only commits
  to uploading documents "as they are received and processed".
- Notices go to the email and phone on the account and count as delivered once posted and
  sent. Keeping contact details current is the customer's job.
- Liability capped at the service fees paid for the affected service in the prior 12 months
  (the provider's cap is a year of fees), with no indirect damages, default judgments,
  penalties or loss of good standing.
- The customer indemnifies Filewell for claims arising from their business, inaccurate
  information, use of the agent's address or a breach.
- Not a law firm, not a government agency.
- The contracting party is the company in `NEXT_PUBLIC_LEGAL_ENTITY`, never a person.
- Every cancellation with the provider is reviewed by staff, and only an admin can record one:
  under the provider's Exhibit A any cancellation on the account is the account owner's
  personal authorization.

If the provider agreement changes, update the terms page and its date in the same change.

### Revisit with a lawyer after first revenue

The owner decided to get legal review once revenue starts. Bring these questions:

1. Whether the liability cap, damages exclusion and indemnity are enforceable as written in the
   states customers come from, and whether a governing law and venue clause should be added
   (`NEXT_PUBLIC_GOVERNING_LAW`).
2. Automatic renewal laws (for example California and New York): disclosure, consent,
   reminder wording and online cancellation.
3. How Registered Agents Inc. being the agent of record must be disclosed.
4. Exhibit A of the provider agreement binds the account owner personally; whether Harborlune
   LLC can take that place.
5. Whether advance notice before a provider resignation can be promised to customers.
6. Sharing client contact details with the provider for collection under Exhibit A.
7. Unauthorized practice of law limits for formation and change filings in each state.
8. Sales tax on registered agent and formation services.
9. Retention periods for received documents and for data after service ends.

## Coverage (52 jurisdictions)

`src/lib/registered-agent/jurisdictions.ts` has one record for each state, DC and Puerto
Rico. The facts are in `src/lib/registered-agent/jurisdiction-facts.ts`, researched Oct 29,
2026 from each jurisdiction's own filing office site or its official statutes, each with the
URL, a verbatim quote and the date checked. Anything that could not be confirmed is `null`,
explained in `unverified`, and blocks the sale that needs it.

Registered Agents Inc. lists all 52 jurisdictions on its own website (one page each, quoted
in the facts file). In Pennsylvania, Registered Agents Inc. is on the Department of State's
list of Commercial Registered Office Providers, so the Pennsylvania block is cleared: the
provider's name goes after "c/o" on the change form.

Formation fees are left out on purpose wherever one fixed fee would be a guess: corporation
fees that rise with authorized shares or add a tax (CT, DE, IL, KY, MA, MD, MI, MO, NM, NV,
NY, OH, OK, RI, VA), Tennessee LLCs (priced per member), publication requirements (NY LLCs, NE, AZ, and GA and PA corporations), Nevada's
extra Initial List and business license, and New Jersey, where two official pages disagree.
Those stay closed for formation; registered agent service there is not affected.

Coverage as of October 29, 2026. Status is for registered agent service: 51 of 52 jurisdictions have every fact verified, so only the nationwide gates remain. Fees are the state's own fee; "not verified" stays closed.

| Jurisdiction | Change fee LLC | Change fee corp. | Formation LLC | Formation corp. | New business | Status |
|---|---|---|---|---|---|---|
| Alabama | $100 | $100 | $200 | $200 | verified | Verified, ready |
| Alaska | $25 | $25 | $250 | $250 | verified | Verified, ready |
| Arizona | $5 | $0 | not verified | not verified | verified | Verified, ready |
| Arkansas | $0 | $0 | $45 | $45 | verified | Verified, ready |
| California | $0 | $0 | $70 | $100 | verified | Verified, ready |
| Colorado | $10 | $10 | $50 | $50 | verified | Verified, ready |
| Connecticut | $50 | $50 | $120 | not verified | verified | Verified, ready |
| Delaware | $50 | $50 | $110 | not verified | verified | Verified, ready |
| District of Columbia | $50 | $50 | $99 | $99 | verified | Verified, ready |
| Florida | $25 | $35 | $125 | $70 | verified | Verified, ready |
| Georgia | $30 | $30 | $110 | not verified | verified | Verified, ready |
| Hawaii | $25 | $25 | $50 | $50 | verified | Verified, ready |
| Idaho | $0 | $0 | $100 | $100 | verified | Verified, ready |
| Illinois | $25 | $25 | $150 | not verified | verified | Verified, ready |
| Indiana | $0 | $0 | $95 | $95 | verified | Verified, ready |
| Iowa | $0 | $0 | $50 | $50 | verified | Verified, ready |
| Kansas | $30 | $30 | $85 | $85 | verified | Verified, ready |
| Kentucky | $10 | $10 | $40 | not verified | verified | Verified, ready |
| Louisiana | $30 | $30 | $125 | $95 | verified | Verified, ready |
| Maine | $35 | $35 | $175 | $145 | verified | Verified, ready |
| Maryland | $25 | $25 | $100 | not verified | verified | Verified, ready |
| Massachusetts | $0 | $0 | $500 | not verified | verified | Verified, ready |
| Michigan | $5 | $5 | $50 | not verified | verified | Verified, ready |
| Minnesota | $35 | $35 | $135 | $135 | verified | Verified, ready |
| Mississippi | $10 | $10 | $50 | $50 | verified | Verified, ready |
| Missouri | $10 | $10 | $50 | not verified | verified | Verified, ready |
| Montana | $0 | $0 | $35 | $35 | verified | Verified, ready |
| Nebraska | $25 | $25 | not verified | not verified | verified | Verified, ready |
| Nevada | $60 | $60 | not verified | not verified | verified | Verified, ready |
| New Hampshire | $15 | $15 | $100 | $100 | verified | Verified, ready |
| New Jersey | $25 | $25 | not verified | not verified | verified | Verified, ready |
| New Mexico | $20 | $25 | $50 | not verified | verified | Verified, ready |
| New York | $30 | $30 | not verified | not verified | verified | Verified, ready |
| North Carolina | $5 | $5 | $125 | $125 | verified | Verified, ready |
| North Dakota | $10 | $10 | $135 | $100 | verified | Verified, ready |
| Ohio | $25 | $25 | $99 | not verified | verified | Verified, ready |
| Oklahoma | $25 | $25 | $100 | not verified | verified | Verified, ready |
| Oregon | $0 | $0 | $100 | $100 | verified | Verified, ready |
| Pennsylvania | $5 | $5 | $125 | not verified | verified | Verified, ready |
| Rhode Island | $20 | $20 | $150 | not verified | verified | Verified, ready |
| South Carolina | $10 | $10 | $110 | $135 | verified | Verified, ready |
| South Dakota | $10 | $10 | $150 | $150 | verified | Verified, ready |
| Tennessee | $20 | $20 | not verified | $100 | verified | Verified, ready |
| Texas | $15 | $15 | $300 | $300 | verified | Verified, ready |
| Utah | $17 | $17 | $59 | $59 | verified | Verified, ready |
| Vermont | $35 | $25 | $155 | $155 | verified | Verified, ready |
| Virginia | $0 | $0 | $100 | not verified | verified | Verified, ready |
| Washington | $0 | $0 | $180 | $180 | verified | Verified, ready |
| West Virginia | $15 | $15 | $100 | $100 | verified | Verified, ready |
| Wisconsin | $10 | $10 | $130 | $100 | verified | Verified, ready |
| Wyoming | $5 | $5 | $100 | $100 | verified | Verified, ready |
| Puerto Rico | not verified | $60 | $250 | $150 | verified | Not verified |

## How an order flows

1. The customer starts at `/registered-agent` or from their business page
   (`/dashboard/services/new?business=…`). Whether the order is a switch is never asked: a
   formed business is switching; a business the customer is forming
   (`/dashboard/services/new-business`, saved as "forming") names us in its formation filing,
   so there is no change filing.
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

### Formation

`/business-formation` leads to `/dashboard/services/formation`: pick the state and type (the
full price appears, state fee on its own line), then the business name, street address,
members or directors, management (LLCs), a contact, and the optional registered agent add-on
(never ticked for the customer; its renewal consent appears only when ticked). The business is
saved as "forming". The operator works the formation order like any provider order (with the
add-on, from the service page; without it, from `/admin/registered-agent/formation/<id>`).
Marking the formation **Completed** with the state's approval date makes the business an
existing business dated that day. The customer follows it at
`/dashboard/services/formation/<order>`.

### Wyoming

The provider must hold the owners' details for Wyoming entities, so Wyoming orders ask for each
owner's name and home address before payment. They appear on the operator's entry sheet only.

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
- `GET /api/cron/services` runs the same checks every hour (at minute 7, `vercel.json`) so
  urgent documents escalate on time. Hourly cron jobs need a Vercel Pro team. With nothing
  sold it finds no records and does nothing. It needs `CRON_SECRET` on Production, like the
  daily reminders cron.

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
- Amendments, good standing, reinstatement, EIN: flagged, not built.
- A provider API adapter (manual dashboard today).
