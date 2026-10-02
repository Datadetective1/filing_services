# State expansion: Washington, Nevada, Utah

Prepared 2026-10-01. Pennsylvania is the only state taking live orders. Washington, Nevada and
Utah are in the same engine with verified rules, lookup, guides and free reminders. Their paid
filing is OFF in production (`WA/NV/UT_LIVE_FILING_SALES` unset). Their $49 service prices are
seeded **unapproved**, so live checkout refuses them even if a switch were set by mistake.

Rules live in `src/lib/compliance/states/{washington,nevada,utah}.ts`, with verbatim quotes and
URLs. Every value below comes from those sources.

## Switches

| Variable | Pennsylvania | WA / NV / UT |
|---|---|---|
| `<STATE>_LOOKUP_ENABLED` | on unless `"false"` | off unless `"true"` |
| `<STATE>_LIVE_FILING_SALES` | on unless `"false"` | off unless `"true"` (staging/preview only today) |

To open a state for real orders, the owner must do two things:
1. Approve that state's price in Admin, then Pricing.
2. Set `<STATE>_LIVE_FILING_SALES=true` on production.

## Washington

| | |
|---|---|
| **Government fee** | $70: domestic and foreign profit corporations, LLCs, LPs/LLLPs, LLPs (WAC 434-112-085(7)(p)). No online processing fee on annual reports. |
| **Late / delinquency** | $25 **only when the state lists the status as Delinquent** (sos.wa.gov forms page; WAC 434-112-085(7)(r)). Delinquency starts after the expiration date. Dissolution can begin 120 days after the due date (RCW 23.95.605). |
| **Due date** | The expiration date: last day of the month the entity was formed or registered (WAC 434-112-060(1)). Can be filed up to 180 days early. |
| **Data source** | CCFS search, which sits behind a Cloudflare challenge. The bulk extract (data.wa.gov f9jk-mm39) is discontinued, and no API is documented. **Advanced Search can filter by expiration date and download CSV in a browser.** |
| **October 2026** | An operator exports CCFS Advanced Search (expiration 10/01–10/31/2026, types LLC/corp, status Active/Delinquent) and uploads it at `/admin/acquisition/october`. The export's status (dated) drives the $25 decision. |
| **Filing** | Express Annual Report (for-profit, previous report on record) appears to need no login; otherwise a free CCFS account. The authorized person types their name; a filing service may file as an authorized agent (RCW 23.95.240). |

## Nevada

| | |
|---|---|
| **Government fees** | Annual List $150 (LLC, LP/LLLP, LLP; corporation at authorized stock ≤ $75,000), plus State Business License $200 (non-corporations) or $500 (NRS 78/80 corporations). LLC = **$350**, corporation (lowest tier) = **$650** (NRS 86.263, 78.150, 76.100/76.130). |
| **Late** | Annual List penalty $75 (NRS 86.272 / 78.170) **plus** State Business License penalty $100 (NRS 76.130(4)). Both are date-based: filed after the due date. Late totals: LLC $525, corporation $825. |
| **Due date** | Last day of the anniversary month of formation (or qualification, if foreign). A list filed more than 90 days early counts as an amended list for the previous year. |
| **Data source** | nvsos.gov and ORION (which replaced SilverFlume on 2026-09-14) sit behind Imperva/hCaptcha bot protection. There's no free export; a paid data report (reportedly $500/month) exists. **Not purchased.** |
| **October 2026** | Not available without buying data. Customers can still look up their own business (manual entry). |
| **Filing** | ORION account (SilverFlume credentials carry over). The list includes a declaration under penalty of perjury signed by an officer or "some other person specifically authorized". |
| **Not offered online** | Corporations above the $75,000 stock tier, publicly traded corporations, nonprofits (NRS 82), business trusts. |

## Utah

| | |
|---|---|
| **Government fee** | $18: LLC, corporation, LP/LLLP, LLP, business trust (FY2026 fee schedule). |
| **Late** | $10 late renewal fee for LLC, corporation, LP/LLLP, LLP. **None** for business trusts (renewal coupon). Filewell applies it only when Utah's record shows Delinquent: S.B. 40 changed the due date today and the Division hasn't published how its late date follows. |
| **Due date** | From 2026-10-01 (Utah Code 16-1a-212, S.B. 40): last day of the anniversary month, deliverable up to 60 days before. The Division may set a different period by rule. |
| **Data source** | The entity search sits behind a Cloudflare challenge; opendata.utah.gov is decommissioned; business lists are paid ($0.01/record). **Not purchased.** |
| **October 2026** | Not available without buying data. |
| **Filing** | UtahID login required. Entities formed after 2024-09-16 have Filing Authority, so the entity's administrator must add Filewell's UtahID as a designated user. |

## Prefill: field classification

A = reliably from authoritative state data · B = from data, customer must confirm ·
C = customer must supply · D = not needed, not asked.

| Field | Washington | Nevada | Utah |
|---|---|---|---|
| Legal name | B (CCFS export if imported) | C | C |
| Entity number (UBI / NV ID / UT #) | B (export) | C (optional) | C (optional) |
| Entity type, foreign | B (export) / C | C | C |
| Formation month / due date | A (export expiration date) / C | C | C |
| State status | A (dated export only) | not available | not available |
| Registered agent | C (export has name only) | D (not on the list) | C |
| Principal office | C (export one-line address) | C (business license place of business) | C |
| Governors / officers | C | C (+ address each) | C (+ address each) |
| Nature of business | C | D | D |
| Email | C (required online) | C (optional) | C (optional) |
| Controlling interest (DOR) | C | D | D |
| Authorized stock tier, publicly traded | D | C (corporations) | D |
| Previous filing / profile values | B (carry forward, all states) | B | B |

Provenance (`filing_prefill`) records source, URL, fetched time, original value, confirmed
value and edits. A later registry lookup never overwrites a customer's correction: prefill only
fills empty fields when a draft is created.

## Human actions needed before any live order

1. **Approve prices** for each state in Admin, then Pricing. The proposed fee is $49 + government fees.
2. **Washington:** run the CCFS Advanced Search export and upload it (October cohort). Optionally create a free CCFS account in Filewell's name.
3. **Nevada:** create an ORION account for Filewell, and decide whether to buy the Secretary of State data report (only with owner approval).
4. **Utah:** create a UtahID for Filewell. Tell customers with Filing Authority (entities formed after 2024-09-16) to add Filewell as a designated user. Decide whether to buy a business list.
5. **Authorization wording:** have counsel review whether the customer authorization covers Nevada's penalty-of-perjury declaration and Washington's "authorized person" attestation when an operator signs.
6. **Late-fee policy:** decide how to collect a status-based state charge (WA $25, UT $10) discovered at filing time when it wasn't in the order. The runbook tells the operator to contact the customer before paying.
7. Re-check Utah's Division guidance on S.B. 40 and any FY2027 fee schedule before opening Utah.
