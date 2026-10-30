# Next five states: Florida, Colorado, South Dakota, Montana, Michigan

Checked 2026-10-29. All five were picked because they charge a real late fee and, unlike
Washington, Nevada and Utah, mostly need no client PIN or state login to file. Every rule
cites official pages with verbatim quotes (see `src/lib/compliance/states/`).

Orders open (owner decision, 2026-10-29): $49 service fee plus the state fee, once
`<STATE>_LOOKUP_ENABLED` and `<STATE>_LIVE_FILING_SALES` are `true` and the price is approved.
Each state's open question in `open-questions.ts` is marked `blocksSales: false`: checkout
works, but no report can be marked ready or filed until the question is answered and removed.
An order that can't be filed is refunded. Colorado and South Dakota are due on anniversary
dates, so an order there may be close to its deadline.

Their public information pages (`/annual-report/<state>/<entity>`, `/states/<state>`) and
sitemap entries appear once this is deployed, the same way Nevada and Utah's do. State
guide pages, footer links, admin acquisition and owner-check screens are not added yet.

| State | Scope | State fee | Due | Late charge | Filing access | Open question |
| --- | --- | --- | --- | --- | --- | --- |
| Florida | LLC, profit corporation | $138.75 LLC, $150 corp | May 1 | $400 after May 1, not waivable; non-profits exempt | Document number, no login | None (customer signs) |
| Colorado | LLC, corporation | $25 | Last day of 2nd month after the report month | $50 after the due date | No login unless Secure Business Filing | None (customer signs) |
| South Dakota | LLC, corporation | $55 online | End of anniversary month | $55 when late | Business ID, no login | `sd_2027_filing_date` |
| Montana | LLC, domestic corporation | Waived on time in 2026 and 2027 | April 15 | $35 after April 15 | No login for no-change reports | None (customer signs) |
| Michigan | Corporation only | $25 | May 15 | $10 a month or part, up to $50 | MiLogin for Business + entity access | `mi_milogin_access` |

## The customer signs (Florida, Colorado, Montana)

Owner decision, 2026-10-30: no lawyer until there is revenue, so Filewell never signs, certifies
or affirms these reports for the customer. Filewell prepares the report, the customer signs it
themselves on the Review and sign step, and the operator enters that signature on the state's
form exactly as typed (`StateAuthorization.customerSignature`, `src/lib/filings/customer-signature.ts`).
The signature is stored with the packet, its hash, the time, and the exact text signed.

- **Florida.** The signer must be one of the principals listed in the report, with the same
  title. Sunbiz's two warnings are shown verbatim. Florida accepts "any symbol, manual,
  facsimile, conformed, or electronic signature" used with the present intent to authenticate
  (s.15.16(5)(b) F.S.), and Sunbiz says typing a name is forgery only "without their
  permission". Sunbiz can't save a report and come back, so a hand-off for the customer to
  finish isn't practical. `fl_signer_permission` is closed.
- **Colorado.** The report names "at least one individual causing the document to be
  delivered", and delivery is that individual's affirmation under penalties of perjury. The
  customer is that individual: they make Colorado's notice themselves, word for word, and the
  operator enters their name with the business's mailing address. The notice is quoted from
  the Secretary's sample form; the operator compares it with the online report at the
  checkpoint and stops if it differs. `co_delivery_affirmation` is closed.
- **Montana.** The signer must be one of the people listed (MCA 35-8-208: a member or the
  authorized agent; MCA 35-2-119(5)(b) for corporations: an officer or authorized agent). The
  three declaration boxes aren't published in text; Montana Business Services emailed a
  screenshot of them on 2026-10-30, and `MT_DECLARATIONS` quotes it verbatim as the rule's
  certification text. The customer makes the declarations when they sign; the operator compares
  each box at filing and stops if the wording differs. `mt_declaration_text` is closed.

## Code changes beyond the state files

- `DueRule.anniversary_month_end.monthsAfter` (Colorado), with `currentFilingPeriod` keeping
  last year's report current while its due date falls in January.
- `StateAuthorization.customerSignature` and the customer signing step above.
- Florida, Colorado, Montana and Michigan block registered agent changes in the intake;
  Florida blocks FEIN changes and never collects the FEIN number; South Dakota blocks the
  January 31 filing date and agricultural land; Montana blocks share changes.
- Montana's public page says "There is no state fee for a report filed on time."

## Not verified

- Florida: whether May 1 moves when it falls on a weekend; the corporation late-fee statute
  and the dissolution date were not re-read.
- Colorado: that the Periodic Report Month is the formation month (the operator checks the
  summary page); the 60 days from Noncompliant to Delinquent.
- South Dakota: how early a report can be filed (Filewell opens the anniversary month); the
  anniversary month in current Secretary wording (only a 2017 pamphlet); the 2025 session
  law itself. The Secretary's instructions page still says $50 late; statute and fee page
  say $55.
- Montana: the on-time fee after the waiver ends. The declaration wording comes from Business
  Services' emailed screenshot, not a public page.
- Michigan: report contents, signer, automatic dissolution and the first-year exemption.
  These come from statute pages that showed a CAPTCHA, so they are not cited. Filewell opens
  Michigan reports on January 15, when LARA says online filing begins; whether anything can
  be filed earlier is not verified.

## Human actions before each state's first filing

1. Done 2026-10-30: Montana's declaration wording (emailed by Montana Business Services).
2. Owner, in each portal (stop before paying): check
   Colorado's Secure Business Filing flow, ask Michigan LARA about filing-service access,
   ask South Dakota how the 2027 filing date is recorded.
3. Close each open question in code once answered, so its filings can be marked ready.
