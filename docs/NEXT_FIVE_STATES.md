# Next five states: Florida, Colorado, South Dakota, Montana, Michigan

Checked 2026-10-29. All five were picked because they charge a real late fee and, unlike
Washington, Nevada and Utah, mostly need no client PIN or state login to file. Every rule
cites official pages with verbatim quotes (see `src/lib/compliance/states/`).

None of them is for sale. Each has an open question in `open-questions.ts`, so checkout and
filing fail closed even if `<STATE>_LIVE_FILING_SALES=true`. Seeded prices are unapproved.

Their public information pages (`/annual-report/<state>/<entity>`, `/states/<state>`) and
sitemap entries appear once this is deployed, the same way Nevada and Utah's do. State
guide pages, footer links, admin acquisition and owner-check screens are not added yet.

| State | Scope | State fee | Due | Late charge | Filing access | Open question |
| --- | --- | --- | --- | --- | --- | --- |
| Florida | LLC, profit corporation | $138.75 LLC, $150 corp | May 1 | $400 after May 1, not waivable; non-profits exempt | Document number, no login | `fl_signer_permission` |
| Colorado | LLC, corporation | $25 | Last day of 2nd month after the report month | $50 after the due date | No login unless Secure Business Filing | `co_delivery_affirmation` |
| South Dakota | LLC, corporation | $55 online | End of anniversary month | $55 when late | Business ID, no login | `sd_2027_filing_date` |
| Montana | LLC, domestic corporation | Waived on time in 2026 and 2027 | April 15 | $35 after April 15 | No login for no-change reports | `mt_signer_declarations` |
| Michigan | Corporation only | $25 | May 15 | $10 a month or part, up to $50 | MiLogin for Business + entity access | `mi_milogin_access` |

## Florida signing

Sunbiz requires one of the business's principals to sign by typing their name, and warns:
"Typing someone´s name/signature without their permission constitutes forgery." Filewell
therefore never signs Florida reports as itself. The authorization page (`authorize-form`)
for a principal-signature state:

- shows Sunbiz's two warnings verbatim,
- requires the signer to be one of the principals listed in the report, with the same title
  (`src/lib/filings/principal-signature.ts`),
- requires an explicit "permit typed signature" checkbox, and
- records signed text that gives Filewell permission to type that name and title on that
  one report only.

Counsel must confirm this is enough before `fl_signer_permission` is closed.

## Code changes beyond the state files

- `DueRule.anniversary_month_end.monthsAfter` (Colorado), with `currentFilingPeriod` keeping
  last year's report current while its due date falls in January.
- `StateAuthorization.principalSignature` and the Florida signing step above.
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
- Montana: the declaration wording; who may sign a corporation's report; the on-time fee
  after the waiver ends.
- Michigan: report contents, signer, automatic dissolution and the first-year exemption.
  These come from statute pages that showed a CAPTCHA, so they are not cited. LARA opens
  online filing January 15; Filewell's fixed-date window opens January 1.

## Human actions before any live order

1. Counsel: Florida principal permission, Colorado delivery affirmation, Montana declarations.
2. Owner, in each portal (stop before paying): capture Montana's declaration text, check
   Colorado's Secure Business Filing flow, ask Michigan LARA about filing-service access,
   ask South Dakota how the 2027 filing date is recorded.
3. Owner: approve a price per state in `/admin/pricing`.
