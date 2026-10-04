# Nevada and Utah: what the owner must do before paid filing

> Superseded for day-to-day use by [OWNER_CHECKS.md](OWNER_CHECKS.md) (call scripts and portal walkthroughs). Since 2026-10-04 the code fails closed on the open questions in `src/lib/compliance/open-questions.ts`.

Checked 2026-10-01/02. Nothing was bought and no account was created. Lookup, guides, reminders and SEO stay live;
paid filing stays OFF (`NV_LIVE_FILING_SALES` and `UT_LIVE_FILING_SALES` are not set on production, and the prices
are unapproved).

## Nevada: establishing ORION access

ORION replaced SilverFlume on 2026-09-14. nvsos.gov and orion.nv.gov both sit behind Imperva bot protection. The
steps below come from archived official pages (the nvsos.gov ORION Information page, 2026-09-26), the SOS's
BizHub site, the portal's own login and checkout screens, and the NRS.
**VERIFIED** = from an official source. **UNVERIFIED** = you need to see or confirm it yourself.

1. Go to https://orion.nv.gov. It redirects to the portal's public page. (VERIFIED)
2. If you have a SilverFlume login, sign in with it: "Your existing SilverFlume username and password will work in
   ORION." (VERIFIED)
3. If not, click **"Are you new user? Register New Account"**. Create the account in your own name. The username
   can't be changed later. (Link VERIFIED. Required identity details, email verification and MFA are UNVERIFIED;
   expect fraud screening.)
4. Payment: either save a card ("Add Payment Method", then "Save Payment Method"), or avoid the 2.5% card fee by
   applying for a **Trust Account** with the SOS accounting division. Use the Trust Account Application on
   bizhub.nv.gov/business-forms; it's for filers "anticipating at least $100.00 in trust account orders annually".
   (VERIFIED)
5. **Before you file for a client**, open "Renew Your Business", then "File Annual List and/or State Business
   License", and search one entity. Confirm whether ORION asks for an entity PIN, an authorization code or a
   "link business" step before a third party can file. Stop before payment. (UNVERIFIED: no official source says
   either way.)
6. Note the signing screen ("Adopt Your Signature") and the declaration under penalty of perjury (NRS 86.263(3),
   78.150). (VERIFIED in statute and portal; UNVERIFIED that it appears on the annual list screen.)
7. Checkout: "Pay and Submit" submits the filing. Unpurchased cart items are removed at month end. Download the
   filed document right away; the links can expire. (VERIFIED in the portal's text)

**Call the Nevada SOS first** (Commercial Recordings, (775) 684-5708, sosmail@sos.nv.gov) and ask:
1. Can any ORION account holder file an annual list for any entity, or is a client PIN or authorization needed?
2. Is there a service-company or Commercial Registered Agent account type, and are annual lists among the 26
   bulk/API filings?
3. **Signer capacity.**
   - For LLCs, NRS 76.100(3)(e) names only a manager or managing member to sign the business license.
   - The annual list allows "some other person specifically authorized" (NRS 86.263(1)(e)).
   - Will the SOS accept the combined filing signed by an authorized filing agent for an LLC? **Counsel should
     review this too.** It decides whether Filewell can sign Nevada LLC filings at all.
4. Is the 2.5% card fee charged on annual lists, and is ACH available?

Do not buy the SOS data report (no cohort without it) unless you decide to separately.

## Utah: the October 1, 2026 framework

**The statute (in force).** Utah Code 16-1a-212 (S.B. 40, effective 2026-10-01):
- The report is due "on the last day of the anniversary month".
- It "may deliver the annual report up to 60 days before", "unless the division specifies a different time period
  by rule".
- Required contents: name, jurisdiction, registered agent, principal office street address, and "the name and
  address of each director and principal officer".
- Administrative dissolution can start if the report isn't delivered "not later than 60 days after" it is due
  (16-1a-602).

**What the Division has published.** Nothing updated for S.B. 40 that I could find. The renewal process page, the
2025 user guides ("Annual Report/Renewal with Changes" / "without Changes", UtahID login) and the FY2026 fee schedule
($18, plus a $10 late or delinquency fee) all predate S.B. 40. No R154 rule changing the period appears in any
2026 Utah State Bulletin. There's no FAQ, notice or transition guidance. The filing portal
(businessregistration.utah.gov) is behind a Cloudflare challenge, so its live screens could not be seen.

**Still unknown:**
- whether a rule will change the period;
- when the $10 late fee applies and when an entity becomes delinquent under 16-1a-212;
- how anniversaries around October 2026 transition;
- the current portal menu and screens, and any filing-agent authorization ("Filing Authority");
- the FY2027 fees.

Filewell already applies the $10 only when Utah's own dated record shows Delinquent, never from a date alone.

**Your steps:**
1. Call the Division, (801) 530-4849. Ask about items 1–4 above, and how a filing service files for a client
   (designated user / Filing Authority).
2. Create a UtahID for Filewell (in your name). Log in to businessregistration.utah.gov, open "Renewals" (or its new
   name), and note the menu and screens. Stop before payment.
3. Tell me what you see. I'll update the Utah rule (new version) before Utah is opened.
