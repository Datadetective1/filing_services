# Pennsylvania data sources, prefill and outreach

Researched and built 2026-09-30. Not legal advice; have counsel review before any outreach.

## 1. Pennsylvania data sources (verified)

| Source | What it is | Machine access | Used for |
|---|---|---|---|
| **data.pa.gov "Registered Businesses in PA Current by County"** (`xvd7-5r2c`, one row per governor/officer; `3urc-uaba` one row per business) | Official Department of State dataset. Licence: *Public Domain U.S. Government*. Refreshed monthly (rows last updated 2026-09-02). ~2.36M businesses. | Yes: Socrata JSON API, no key needed (`SOCRATA_APP_TOKEN`, free, raises shared limits) | Prefill (search + record) and prospect import |
| file.dos.pa.gov Business Search | The state's live register UI | **No.** Every path (including robots.txt and `/api/Records/businesssearch`) returns a Cloudflare managed challenge (HTTP 999). No documented API. | Never automated. Operators use it by hand. |
| DOS lists / printouts | New-association lists monthly at $0.25 per name; written entity printouts $15 | Purchase (owner approval) | Not used |
| OpenCorporates | Licensed aggregator (PA covered) | Paid API from £2,250/yr; ODbL share-alike for free use; scraping prohibited | Not used (would need owner approval) |

**What the open dataset has:** business name (title-cased, not exact legal casing), filing
number (entity number, zero-padded), registration type, creation date, one street address +
county (most likely the registered office; the dataset doesn't say), and governor/officer
names with titles (`party_type`).

**What it does not have:** standing/status, annual-report filing history, which address it
is, principal office, emails or phones. It covers current registrations and can lag the live
register by up to a month. No public PA source exposes business emails.

**Annual report facts (pa.gov, re-verified):** DSCB:15-146 fields: name, jurisdiction of
formation, entity number, registered office or CROP + county, principal office, at least
one governor, principal officers if any. Deadlines: corporations (business and nonprofit)
June 30; LLCs September 30; LPs, LLPs, business trusts, professional associations
December 31. Fee $7 ($0 nonprofits / not-for-profit LLCs and LPs). No state late fee.
Administrative dissolution/termination applies starting with reports due in 2027, six
months after the due date.

## 2. Prefill

| Intake field | Category | Source |
|---|---|---|
| Legal name | B: confirm (register casing differs) | Register |
| Entity number | A | Register |
| Jurisdiction of formation | A for domestic ("Pennsylvania"); C for foreign | Register type |
| Registered office | B: register address when in PA; customer confirms or switches to CROP | Register |
| Principal office | C (register doesn't say which address it has) | Previous filing / profile |
| Governors | B | Register (Governor, Member, Manager, Director, Trustee, General Partner) |
| Principal officers | B | Register (President, Treasurer, Secretary, CEO...) |
| Changes since last report | C (one click: "Nothing has changed") | Customer |
| State notice email | C (optional) | Customer |
| Entity type, foreign, nonprofit (lookup) | A (from registration type) | Register |
| Formation date (lookup) | A | Register |
| "Already filed this year" (lookup) | D for register picks (not shown on the register; the customer can mark it filed later) | |

Organizers and incorporators are never treated as governors.

**Typed fields, typical PA LLC with one governor, first filing:** before ~15 (name, entity
type, entity number, 5 registered-office fields, 4 principal-office fields, governor name +
title, changes question). After: 1 search box + 4 principal-office fields (0 in later years:
carried from the previous filing), plus clicks to confirm.

**Provenance:** `filing_prefill` stores, per field, the source, source URL, retrieved_at
and original value; at signing it stores the confirmed value and whether the customer
edited it. Prefill happens only when the draft is created; later lookups never touch
answers. "Came from the state" claims rest only on `state_entity_records`, which only the
server writes (service role).

**Failures:** no match, unavailable register (6 s timeout), rate-limited (30 searches /
minute / visitor), unsupported type, foreign entity (jurisdiction asked), stale record
(monthly refresh disclosed), entity-type mismatch: every path falls back to manual entry.

**Measured (analytics events):** `registry_search` (found / none / unavailable),
`registry_selected`, `prefill_applied` (fields, from register, from previous filing),
`prefill_confirmed` (fields, edited, seconds from draft to signature).

## 3. Reminders and prospects

**Customers (live):** business added -> requirement + due date from the verified rule ->
reminder plan (-90 ... +30 days) -> daily cron sends at most one reminder per deadline per
run (superseded older ones skipped) -> suppressed when a filing is in progress, filed, or
the customer opted out (one-click unsubscribe) -> accepted filing rolls the next year
forward with fresh reminders.

**Prospects (dry run only):** data.pa.gov -> `state_entity_records` (business-level) ->
`prospects` (customers linked and excluded) -> `assessSituation` (segment from verified
rules) -> optional `contact_points` (each with source and licence; none exist: no source
provides emails today) -> compliance gate -> `marketing_sends` dry-run rows -> (future)
approved provider -> clicks/unsubscribes/conversions.

Segments: approaching deadline (within 60 days); deadline passed with filing status
unknown; "outstanding" only when a source shows the report unfiled (none does today).
Businesses a source shows as filed, and first-year businesses, are never selected.

## 4. Outreach compliance

- **CAN-SPAM** (applies to B2B): accurate headers and subject, clear advertisement label,
  valid physical postal address (street, P.O. box or registered CMRA box), clear opt-out
  that works >= 30 days, honoured within 10 business days, no fee or extra info to opt
  out, never sell opted-out addresses. Up to $53,088 per violating email.
- **FTC Impersonation Rule (16 CFR 461, 2024):** no implied government affiliation.
- **Pennsylvania:** UTPCPL catch-all against likely confusion; the 2002 Unsolicited
  Telecommunication Advertisement Act (anti-deception parts survive CAN-SPAM preemption).
  DOS publicly names filing services that imply fees or consequences that don't exist.
  California (B&P 17533.6) and Georgia (10-1-393.16) have explicit "not a government
  document" rules; our disclaimer goes further than PA requires.
- **Mailbox providers:** SPF, DKIM, DMARC, RFC 8058 one-click unsubscribe, spam < 0.3%.
- **Resend's acceptable-use policy prohibits cold outreach, purchased lists and scraped
  contacts.** Resend stays for transactional and opted-in mail. Cold outreach would need a
  separate, owner-approved provider and sending subdomain.

Implemented gate (all required to send): approved campaign with unchanged content; public
postal address; approved non-Resend provider; valid non-governmental `@getfilewell.com`
sender; `MARKETING_SENDS_ENABLED=true`; per recipient: known source, business email with a
source and a marketing licence, not suppressed, not a customer, in segment. The code has no
send path at all today.
