# Pennsylvania December 31 postcard pilot (design only)

Prepared 2026-10-01. **Nothing has been purchased or mailed.** There is no mail-vendor
integration in the code. Prices were read from vendor sites on 2026-09-30; laws were read
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

Copy side (rendered for review in Admin > Outreach > the pilot; HTML template via
"Card template (HTML)"):

> **THIS IS A SOLICITATION. NOT A BILL OR OFFICIAL GOVERNMENT DOCUMENT. NOT SENT BY THE PENNSYLVANIA DEPARTMENT OF STATE.**
> Filewell · Private filing service · Advertisement
>
> **Your 2026 Pennsylvania annual report may be due by December 31.**
> For {{business_name}}
> - File it yourself at file.dos.pa.gov: $7.00 state fee ($0.00 for not-for-profit associations). You don't need a filing service.
> - Or have Filewell file it for you: $49.00 service fee + $7.00 state fee = $56.00.
>
> Already filed? Please ignore this card.
> **Start here: www.getfilewell.com/m/{{code}}**
>
> *Filewell is a private filing service operated by Amary Coulibaly, sole proprietor. It is not the Pennsylvania Department of State and is not affiliated with, endorsed by or acting for any government agency.*
> *This is a solicitation for the order of goods or services, or both, and not a bill, invoice, or statement of account due. You are under no obligation to make any payments on account of this offer unless you accept this offer.*
> *Pennsylvania charges no late fee for annual reports. To stop mail from Filewell, email support@getfilewell.com.*
> *Filewell, [return address]*

Address side: vendor address block and postage. No seals, keystones, agency-like names,
"notice", "final", deadlines framed as penalties, or amounts styled as a balance due.

Each card's URL is unique and signed. It opens that business's own "Pennsylvania record
found" page (prefilled lookup), records the visit, and a forged code just opens the normal
lookup.

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

## 6. What's built

- Admin > Outreach > "New postcard pilot": selection, exclusions, the rendered card, costs,
  "Record dry run", "Approve card content" (records approval only).
- Export CSV (admin only, audited): included, exclusion_reason, business_name,
  entity_number, entity_type, registration type, mailing address, county, report year,
  deadline, landing_url, landing_code, source, source_url, retrieved_at, campaign_id.
  Spreadsheet-formula safe.
- `/m/<code>` landing with click attribution.

## 7. Before any money is spent (owner)

1. Approve the pilot size and budget.
2. A return address for the card (a mailbox service, not your home).
3. Counsel's review of the card.
4. Create the vendor account (Lob recommended); add `MAIL_VENDOR` and the key; we then
   build the adapter against the test key.
5. Turn on `MAIL_SENDS_ENABLED` only for the approved pilot.
