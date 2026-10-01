# Pennsylvania December 31 postcard pilot (100 cards, test mode only)

Prepared 2026-10-01. **Nothing has been purchased or mailed.** The Lob integration exists
but only runs with a `test_` key (Lob never mails test pieces); live keys are refused while
`MAIL_SENDS_ENABLED` is not `true`, and it is not set anywhere. Prices were read from vendor sites on 2026-09-30; laws were read
from primary sources the same day. Not legal advice: have counsel review the card.

## 1. Who

Pennsylvania associations whose annual report is due **December 31**: limited partnerships,
LLPs, electing partnerships, professional associations and business trusts (domestic and
foreign). Source: the Department of State open dataset on data.pa.gov (public domain,
monthly). **68,224** such registrations are in the dataset today.

Excluded (exported with the reason on every row):

| Exclusion | Why |
|---|---|
| First-year entity | First report is due the year after formation |
| Existing Filewell customer | Matched by entity number |
| Not a December 31 type | LLCs (Sept 30) and corporations (June 30) are other pilots |
| Deadline more than 120 days away, or passed | Mail only when it is actionable |
| No / incomplete / non-U.S. address | Undeliverable |
| Care-of or agent-service address line (c/o, attn, "registered agent", "incorporating services") | Reaches an agent or attorney, not the owner |
| 3+ entities at the same street address | Almost always a registered agent or CROP (e.g. 1,637 entities at one Harrisburg address); a card there reaches the agent, not the owner. About 22,764 of the 68,224 (33%) |

The dataset has no standing or filing history, so no one is selected or excluded as
"filed", "not filed", "active" or "compliant". The card says the report **may** be due.

Expected mailable pool: roughly 45,000 statewide, enough for every pilot size. Start with
one or two counties to keep fulfilment manageable.

## 2. The card (6x4 in, First-Class)

Final copy (template `pa_dec31_postcard@2026-10-01b`, `src/lib/outreach/postcard.ts`).
Proofs: `docs/mail-pilot/postcard-front-sample.png`, `postcard-back-sample.png`,
`postcard-proof-sample.pdf` (placeholder business name).

Front, top band (largest type on the card):

> **THIS IS A SOLICITATION. NOT A BILL. NOT A GOVERNMENT DOCUMENT.**
> Not sent by the Pennsylvania Department of State. Filewell is a private filing service. Advertisement.
>
> **Your 2026 Pennsylvania annual report may be due by December 31.**
> For {{business_name}}
> - File it yourself: you can file directly with the Pennsylvania Department of State at file.dos.pa.gov for the $7.00 state fee ($0.00 for not-for-profit associations) instead of using Filewell.
> - Or let Filewell file it: $49.00 service fee + $7.00 state fee = $56.00.

Back, left column (right side left blank for Lob's address block and postage):

> Disclosure repeated, the direct-filing option repeated, the card's QR code and its
> unique URL `www.getfilewell.com/m/{{code}}`, "Already filed? Please ignore this card."
> Fine print: Filewell is a private filing service operated by Amary Coulibaly, sole
> proprietor, not the Pennsylvania Department of State and not affiliated with, endorsed by
> or acting for any government agency; the solicitation statement (section 3); Pennsylvania
> charges no late fee for annual reports; to stop mail, email support@getfilewell.com;
> return address.

No seals, keystones, agency-like names, "notice", "final", penalty framing, or amounts
styled as a balance due. The card never says filed, unfiled, active, compliant,
delinquent or outstanding: only "Pennsylvania record found" (landing page) and "may be due".

Each card's URL is unique and HMAC-signed (`<campaign>-<entity>-<signature>`); a forged or
altered code just opens the normal lookup, and its QR route returns 404.

## 3. Rules that shape the card

- **39 U.S.C. § 3001(d)** addresses solicitations that could reasonably be read as a bill,
  invoice or statement of account. Because the card shows fees, it includes a
  "solicitation ... not a bill" statement modeled on the language that provision describes,
  as a precaution. Whether § 3001(d) applies to this card, and whether this wording (or any
  other on the card) satisfies it or any other rule, is for counsel to confirm; nothing here
  is a statement of legal sufficiency.
- **39 U.S.C. § 3001(h)–(j)** cover implied *federal* connection only; they don't reach a
  state-agency look-alike.
- **FTC Impersonation Rule (16 CFR 461, 2024)** covers state agencies: no implied affiliation.
- **Pennsylvania:** no statute specific to mailed compliance solicitations (a 2026
  co-sponsorship memo on solicitation disclaimers has not been introduced). The Department
  of State publicly names filing services whose mail implies fees or consequences, and
  stresses the $7 direct option, so the card leads with both disclaimers and that option.
- **Models followed as best practice:** Georgia O.C.G.A. § 10-1-393.16 (top-of-page
  "THIS IS A SOLICITATION. THIS IS NOT A BILL OR OFFICIAL GOVERNMENT DOCUMENT"), California
  B&P § 17533.6 (not approved or endorsed by any governmental agency).

## 4. Vendors (programmable direct mail)

| Vendor | 4x6 First-Class, print + postage | Fees / limits | API |
|---|---|---|---|
| **Lob** | Developer (free plan) $0.905, $0.909 from Nov 1, 2026; Startup $0.645 ($0.649) + $260/mo; Growth $0.615 ($0.619) + $550/mo | No minimum on First-Class. Marketing Mail needs 200 pieces; 4x6 Standard availability is inconsistent in Lob's docs | Free test keys (nothing mailed), idempotency keys, HTML/PDF templates with merge variables, address verification (+ NCOA), QR codes, webhooks, cancel before send date |
| **PostGrid** | $0.902 | Starter free but capped at 500 pieces a month; 4x6 not offered as Standard | Test key (nothing mailed), Idempotency-Key (24 h), webhooks, address verification |
| **Click2Mail** | From about $0.56 First-Class / $0.395 Marketing Mail (2025 blog; print inclusion unverified, site blocked automated reading) | Marketing Mail 200-piece minimum | REST API with a staging environment; other capabilities unverified |

USPS postcard stamp: $0.65 since July 12, 2026 (retail).

**Recommendation:** Lob.
- **100 to 1,000 pieces: Lob Developer (no monthly fee).** Its test keys let us build and
  verify the whole integration (idempotent create, webhooks, unique QR/URL) at no cost, and
  it doesn't split 1,000 pieces across months like PostGrid's free tier.
- **5,000 pieces: Lob Startup for one month** ($260 + $0.649/piece), about $1,040 cheaper
  than Developer.
- Re-check Click2Mail's Marketing Mail price before a 5,000+ run; if it includes print it
  could be cheaper, at the cost of slower delivery and a less proven API.

Integration plan (after your approval and an account): server-only `MailVendor` adapter
behind the existing gate (approved card + return address + `MAIL_VENDOR` +
`MAIL_SENDS_ENABLED`), Lob `test_` key on preview, `idempotency_key = marketing_sends.id`,
`use_type=marketing`, merge variables `business_name` and `landing_url`, webhook events
into `marketing_sends` (status, delivered/returned), returned mail -> exclusion.

## 5. Cost and unit economics

Net per paid order: $49.00 service fee minus Stripe's fee on $56.00 ($1.92) = **$47.08**.
The $7.00 state fee passes through. Prices are 4x6 First-Class after Lob's Nov 1 increase.

| Pieces | Cheapest plan | Cost | Per piece | Break-even (orders / rate) | 0.5% paid | 1% paid | 2% paid |
|---|---|---|---|---|---|---|---|
| 100 | PostGrid Starter | $90.20 | $0.902 | 2 / 2.0% | 0.5 orders, -$66.66 | 1, -$43.12 | 2, +$3.96 |
| 500 | PostGrid Starter | $451.00 | $0.902 | 10 / 2.0% | 2.5, -$333.30 | 5, -$215.60 | 10, +$19.80 |
| 1,000 | Lob Developer | $909.00 | $0.909 | 20 / 2.0% | 5, -$673.60 | 10, -$438.20 | 20, +$32.60 |
| 5,000 | Lob Startup (1 month) | $3,505.00 | $0.701 | 75 / 1.5% | 25, -$2,328.00 | 50, -$1,151.00 | 100, +$1,203.00 |

(Lob Developer at 100 / 500 pieces: $90.90 / $454.50.) Conversion rates are assumptions;
direct-mail response for an unknown small brand is often well under 1%. **A one-time
mailing breaks even only near 2% paid response.** The case for the pilot is learning
(response rate, landing conversion, cost per order) and repeat value: a customer who files
with us is reminded every year, so lifetime value is several years of $47.08 if they stay.

Suggested pilot: **500 cards, two counties, mailed the first week of November**
(about $451-$455), measure for 6 weeks; expand only if paid response is at or above ~1%
with good repeat signals.

## 6. The 100-card cohort

Built with `npx tsx scripts/build-pa-mail-cohort.mts --size 100 --pool 600` from the
data.pa.gov register (domestic December 31 types, formed before 2026, newest first) and
saved to production campaign `78fc115b-c545-4599-a6ad-2365551df4b6`
("PA Dec 31 pilot: 100 cards", draft). Selection is a deterministic hash order over the
eligible rows; 54 eligible rows are held in reserve.

Exclusions on the 600-row pool (a row can have more than one): shared address (3+
registrations at the street address: agent/CROP) 337, duplicate address within the pool 87,
name/type mismatch (e.g. "LLC" or "Company" on an LP record) 25, personal name 5,
government-like name 3, PO box 2, no street number 1, questionable characters 1. Also
applied: existing customer, first-year entity, foreign entity, non-PA or incomplete
address, care-of/agent lines, wrong deadline group, address or name too long for the card.

## 7. What's built

- Admin > Outreach > the pilot: funnel (mailed, visits, record viewed, filing started,
  checkout started, paid), conversion, acquisition cost, service-fee revenue, estimated
  mailing cost, contribution after Stripe and mail, break-even paid orders; selected and
  not-selected tables with reasons; front/back artwork for any selected card; "Approve card
  content" (records approval only); Lob panel.
- `/m/<code>`: verifies the code, records the visit, opens that business's prefilled
  "Pennsylvania record found" page, and sets an attribution cookie so "record viewed" and
  "filing started" are counted. `/m/<code>/qr.png`: the card's QR code.
- Export CSV (admin only, audited, formula-safe): selected, exclusion_reason, business,
  address, deadline, landing URL/code, source.
- Lob adapter (`src/lib/outreach/lob.ts`): 4x6, `use_type=marketing`, First-Class,
  idempotency key per send, metadata. "Create Lob test pieces" only appears with a `test_`
  key. There is **no live-send action yet**: it gets built and reviewed after test pieces
  have been checked and mailing is authorized.

## 8. Remaining owner steps

1. Counsel's review of the card (proofs in `docs/mail-pilot/`).
2. A return address (a mailbox service, not your home); set `MAIL_FROM_NAME`,
   `MAIL_FROM_LINE1`, `MAIL_FROM_LINE2`, `MAIL_FROM_CITY`, `MAIL_FROM_STATE`,
   `MAIL_FROM_ZIP` in Vercel.
3. Create a Lob account (free Developer plan, no payment method needed for test keys); set
   `LOB_API_KEY` to the **test** key in Vercel; create test pieces from the dashboard and
   check Lob's rendered proofs.
4. Approve the card in Admin.
5. Only to mail: add a payment method in Lob, swap in the live key, set `MAIL_VENDOR=lob`
   and `MAIL_SENDS_ENABLED=true`, and have the live-send action built. Estimated cost:
   100 x $0.909 = **$90.90**; break-even is **2 paid orders** ($47.08 net each).
