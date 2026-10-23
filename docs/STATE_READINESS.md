# State readiness: Washington, Nevada, Utah

**This is the single source of truth for whether each expansion state can take a real paid
filing.** Updated 2026-10-23. Detail lives in the linked docs; where they disagree with this
page, this page wins and the conflict is listed under "Contradictions".

Labels used on every line:

- **VERIFIED**: quoted from an official source cited in `src/lib/compliance/states/*.ts`.
- **DECISION**: an implementation choice Filewell made (not a state rule).
- **STATE Q**: an unresolved question only the state can answer (also in
  `src/lib/compliance/open-questions.ts`, where it blocks sales and filing).
- **COUNSEL Q**: an unresolved legal question for counsel.
- **PORTAL CHECK**: something the owner must see in the state's portal.
- **BLOCKER**: must be cleared before the state takes a real paid order.

## Switches and gates (all states)

| Gate | Where | State today |
|---|---|---|
| `<STATE>_LIVE_FILING_SALES` | env, production | **OFF** for WA, NV, UT (unset). Only `"true"` turns it on. |
| Approved service price | Admin → Pricing | WA $49 approved; NV, UT unapproved (live checkout refuses unapproved prices). |
| Open state questions | `open-questions.ts` | NV ×2, UT ×2. Block sales wherever real money could be taken (production **or** `PAYMENTS_LIVE_ENABLED=true`) and block Mark ready / Start filing / Mark submitted everywhere. |
| Nonprofits | `isSellableForBusiness` | Never sold in WA, NV or UT (out of scope in each state file). |
| Public claims | `stateSupportLabel` | "Filing supported", our price and the service JSON-LD appear only while a state's sales are open. Reminder emails offer our filing only where we sell it. |

To open a state the owner must: (1) clear every BLOCKER below, (2) remove that state's open
questions in a reviewed change that records the answers (new rule version if anything changes),
(3) approve the price, (4) set `<STATE>_LIVE_FILING_SALES=true` on production.

## Washington

| | |
|---|---|
| Rule | `WA:annual_report:*` **v3** (2026-10-23, PR #20, unmerged until the CCFS walkthrough). v3 changes only the authorized-person certification; production still runs v2. |
| Government fee | VERIFIED $70 (WAC 434-112-085(7)(p)); no online processing fee (075(1)(a)). |
| Delinquency fee | VERIFIED $25 "If the business entity's status is listed as Delinquent". DECISION: charged only from a Washington CCFS export record for the entity number being filed, dated within 14 days and never future-dated; otherwise shown as possible, not charged. |
| Due date | VERIFIED last day of the formation/registration month (WAC 434-112-060(1)); up to 180 days early. |
| Certification | VERIFIED (Annual Report form, Revised 6.2025, §7): "I hereby certify, under penalty of law, that the above information is accurate and complies with the filing requirements of state law." Shown to the customer before signing and stored with the signature. A signature quoting older wording is re-signed before checkout and blocks filing. |
| Registered agent consent | VERIFIED: required for a new agent (form p.2, RCW 23.95.415); "The appointed agent must sign the Consent to Serve statement". DECISION: two paths only: the signer is the agent and ticks Washington's statement, or the agent's own signed consent is uploaded (only an upload made after the latest signature counts). Filewell never consents for the agent. |
| Filing authority | VERIFIED RCW 23.95.240(2): an agent executing a filing affirms it is authorized. COUNSEL Q: does the click-through authorization cover the operator making the §7 certification? |
| Portal | CCFS Express Annual Report; Cloudflare check done by hand. |
| BLOCKER | PORTAL CHECK: the CCFS checkbox wording. The online instructions page still quotes the old wording ("This document is hereby executed under penalty of law ..."); v3 uses the form's. PR #20 stays unmerged until the walkthrough settles which text CCFS shows. |
| BLOCKER | PORTAL CHECK: the exact Registered Agent Consent radio wording, and whether a contact-details-only agent change asks for consent (online instructions: not required; paper form: page 2 "REQUIRED FOR ALL TYPES"). |
| BLOCKER | COUNSEL Q above. |

## Nevada

| | |
|---|---|
| Rule | `NV:annual_report:*` v2 (2026-10-04). |
| Government fees | VERIFIED Annual List $150 (LLC/LP/LLP; corporation at authorized stock ≤ $75,000) + State Business License $200 (non-corporations) / $500 (NRS 78/80 corporations); itemized separately. |
| Late penalties | VERIFIED $75 list (NRS 86.272 / 78.170) + $100 business license (NRS 76.130(4)), date-based. DECISION (open, see below): the due date comes from the formation date the customer typed (no NV data source). |
| Stock tier | DECISION: customer answer; over $75,000 and publicly traded corporations are refused online. |
| Disclosure | DECISION: both investigation answers Yes refuses the order. The potential $100,000 fee has no `RuleSource` (see Contradictions). |
| Business-license exemption | DECISION: a Yes answer refuses the order. |
| Signer authority | STATE Q `nv_signer_authority` (LLC, LP, LLP): blocks sales and filing for those types. Corporations are not blocked by it. |
| ORION access | STATE Q `nv_orion_client_access` (all types): blocks sales and filing for **every** NV type, corporations included. |
| BLOCKER | Both STATE Qs; COUNSEL Q on "some other person specifically authorized" (NRS 78.150(1)(e), 76.100(3)(f)); price approval. |

## Utah

| | |
|---|---|
| Rule | `UT:annual_report:*` v2 (2026-10-04). |
| Government fee | VERIFIED $18 (FY2026 fee schedule). |
| Late fee | VERIFIED a $10 late renewal fee exists. DECISION: **never charged by Filewell** until the Division confirms how its record shows a late renewal: Utah statuses are not read as evidence (`STATUS_SOURCE_BY_STATE` has no UT). The sources print a per-renewal "Late Date", not a "Delinquent" status. |
| Due date | VERIFIED 16-1a-212 (S.B. 40, 2026-10-01): last day of the anniversary month; up to 60 days early "unless the division specifies a different time period by rule". Filing (and payment) is refused earlier than 60 days. |
| S.B. 40 operations | STATE Q `ut_sb40_operations`: blocks sales and filing. |
| Third-party filing | STATE Q `ut_third_party_filing` (Filing Authority / designated user / signer title): blocks sales and filing. |
| BLOCKER | Both STATE Qs; PORTAL CHECK of the UtahID renewal screens; price approval. |

## Contradictions found (not resolved here)

1. **WA certification**: online instructions (old wording) vs Revised 6.2025 form (new wording). Resolved only by the CCFS walkthrough.
2. **WA agent consent for contact-only changes**: online instructions vs paper form p.2.
3. **NV signer authority for LLC/LP/LLP**: `open-questions.ts` and NEVADA_UTAH_ACCESS.md say the annual list "allows an authorized person" for these types, but the only quoted source for that phrase is the corporation statute (NRS 78.150(1)(e)). STATE_EXPANSION.md applied the corporation signer rule to every type.
4. **NV $100,000 disclosure fee and LLP exclusion**: no `RuleSource` for either.
5. **NV "no-par shares count as $1 each"** help text: unsourced.
6. **UT "Entities formed after 2024-09-16 have Filing Authority"**: unsourced; the only source calls it "an optional security feature".
7. **UT business-trust $18 / no late fee**: quoted from the 2021 renewal coupon, attributed to the fee schedule.
8. **UT UtahID**: runbook says "Filewell's UtahID"; owner checks say "your name".

## Owner decisions still open

- **NV late filers**: the $75 + $100 penalties are statutory and date-based, but the due date rests on the customer's typed formation date. Options: keep charging (operator confirms in ORION and refunds a difference), or refuse online checkout for past-due NV filings until a state-sourced due date exists.
- **UT far past due** (more than 60 days, dissolution may begin): sell or refuse online.
- **Status-based charge found at filing time** (WA $25 not in the order): how to collect.

## Manual checks still needed (only what Claude can't verify)

### Washington: CCFS walkthrough (Express Annual Report, "with changes"; stop before Add to Cart)

1. **Certification text** at the Authorized Person checkbox. Copy it exactly.
   - If it reads "I hereby certify, under penalty of law, that the above information is accurate and complies with the filing requirements of state law." → PR #20 is right.
   - If it still reads "This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct." → tell me; PR #20 must change before merge.
2. **Registered Agent Consent**: copy the exact wording of each radio button.
3. **Contact-only agent change**: edit only the agent's email or phone (same agent, same street address). Does CCFS ask for consent? Yes / No.
4. **Screen order**: any section missing, added, or in a different order from: Business Information → Registered Agent → Principal Office → Governors → Nature of Business → Effective Date → Controlling Interest → Return Address → Upload → Authorized Person → Review.

### Nevada: call Commercial Recordings, (775) 684-5708

1. Will you accept the combined annual list and State Business License for an **LLC, LP or LLP** signed by the client's authorized filing agent, or must a manager/managing member, general partner or managing partner sign?
2. For a **corporation**, does a written client authorization make the agent "some other person specifically authorized" (NRS 78.150(1)(e), 76.100(3)(f))?
3. Can a filing service's ORION account file an annual list for any entity, or is a client PIN, authorization code, entity link or service-company account required?
4. Does the investigation/market-share disclosure apply to **LLPs**? Is the fee $100,000 when both answers are Yes?
5. Is the 2.5% card fee charged on annual lists? Is a trust account or ACH available for a filing service?
6. If a list is more than a year late or the charter is revoked, can the annual list still be filed, or is reinstatement required?

**ORION (your account; stop before Pay):**
1. Any PIN, authorization or "link business" prompt before an entity's list opens.
2. Signer title options and the declaration wording, for one LLC and one corporation.
3. Whether the disclosure screen appears for an LLP.
4. Corporation screens: how the stock tier and fee are shown; the publicly-traded / CIK questions.
5. Fees shown (list, business license, card fee) and how penalties appear on an overdue entity.
6. How status (Active / Default / Revoked) is shown.

### Utah: call the Division of Corporations, (801) 530-4849

1. Under 16-1a-212, from what date is the $10 late renewal fee charged, and what "Late Date" will the notice print?
2. When the fee applies, what does the entity's record show ("Delinquent", "Expired", something else)?
3. For entities whose old anniversary fell in September–November 2026, what is the due date and the late date?
4. Is the 60-day early window in effect, or has a rule set a different period?
5. Can a filing service file for clients from one staff member's personal UtahID?
6. Is Filing Authority on by default for any group of entities (e.g. formed after 2024-09-16)? Does a filing agent need anything else from the customer?
7. Which signer title should an authorized filing agent choose?
8. Are business trusts covered by 16-1a-212? Is their renewal $18 with no late fee? Is a FY2027 fee schedule coming?

**UtahID portal (your account; stop before payment):**
1. Exact menu names and screen order for a renewal.
2. The message shown for Filing Authority / designated-user status, and where an administrator adds a designated user.
3. Exact wording of the attestation/authorization checkboxes and the signer-title options.
4. The fee, the "Late Date" (or due) field, and the status label on an entity past its anniversary month.
5. Whether a foreign entity's assumed name and the principals are prefilled.
