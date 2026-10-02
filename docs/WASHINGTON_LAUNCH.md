# Washington: authorization and operator path

Prepared 2026-10-02. The Washington service fee ($49) was approved by the owner in writing on
2026-10-01 and recorded in production (`service_prices` WA row `approved=true`, audit_logs id 17).
**Washington sales stay OFF**: `WA_LIVE_FILING_SALES` is not set on production.

Sources (checked 2026-10-01/02):
- Annual Report form, Revised 6.2025:
  https://www.sos.wa.gov/sites/default/files/2025-12/6.2025%20-%20Annual%20Report%20-%20Profit%20Entity%20Types%2023B%20M%26M%20%26%20Corp%20Sole%20%28Fillable%20Form%29.pdf
- Online filing instructions:
  https://www.sos.wa.gov/corporations-charities/business-entities/online-filing-instructions/file-annual-report-multiple-entity-types-online
- RCW 23.95.415 (registered agent consent), RCW 23.95.240 (filing as an agent), RCW 23.95.255 (annual report contents)
- CCFS Express Annual Report page: https://ccfs.sos.wa.gov/#/expressAnnualReportSearch/BusinessSearch

## What the state requires

| Requirement | Official wording |
|---|---|
| Authorized person's certification (online) | "This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct." |
| Registered agent consent (online) | "The Consent of the Registered Agent is required if any changes other than contact info is made. By selecting one of the radio buttons under 'Registered Agent Consent' the submitter is attesting to the statements listed." |
| Consent (statute) | "A registered agent shall not be appointed without having given prior consent in a record to the appointment." (RCW 23.95.415) |
| Consent statement (form p.2) | "I hereby consent to serve as Registered Agent in the State of Washington for the named business. ..." Signed by the agent, any agent type. |
| Controlling interest (DOR) | Four questions (1, 2, 2a, 3). Online, every answer starts at "No". |
| UBI + name | "The UBI Number and name of the business must match our records in order to be accepted." |

## Customer flow (built)

1. **Intake (rule v2).** UBI is required (9 digits; spaces or hyphens allowed). The registered-agent section asks
   whether the agent changes (no / contact details only / new agent or new street address), the agent type
   (commercial / noncommercial), the name, the Washington street address (noncommercial only) and the agent email
   (noncommercial agents whose details change). Controlling interest asks the state's four questions word for word;
   2a and 3 are asked only when the form asks them. A later "No" removes the earlier follow-up answers, so a stale
   answer is never filed.
2. **Review and sign (before payment).** The customer sees the full **filing packet**: every value Filewell will
   enter, grouped and ordered like CCFS (Business Information, Registered Agent, Principal Office, Governors, Nature
   of Business, Effective Date, Controlling Interest, Return Address, Upload, Authorized Person). Each item has an
   Edit link.
3. **Authorization text (terms version `<legal date>.v2.state1`).** It names "Amary Coulibaly, sole proprietor,
   doing business as Filewell" (from `NEXT_PUBLIC_LEGAL_ENTITY`). The customer confirms they reviewed every item,
   and it quotes the state's certification that the filing agent will make relying on their confirmation. There is
   an extra required checkbox for exactly that.
4. **New registered agent.** The customer must choose one of two options; nothing is assumed:
   - *I am the agent*: they tick Washington's consent statement, which is stored verbatim with their name, title
     and time.
   - *Someone else is the agent*: checkout shows that Filewell won't file until the agent's signed consent arrives.
     Staff upload it as document type "Registered agent consent".
5. **What's stored.** Each signature is a new append-only `filing_authorizations` row. It holds the answers and
   their hash, the packet in CCFS order and its hash, the rule version, the filing agent, the certification text,
   the consent record, the IP hash and the user agent. Older signatures are never changed.
6. **Edits after signing.** Each save writes `filing.answers_changed_after_authorization` to the audit log with the
   fields, the signed values and the new values. Checkout redirects to Review ("Your details changed after you
   signed"). Filing is blocked until the customer signs again.

## Operator flow (built)

Order page, Washington runbook:
- **Fields in CCFS order.** Values come from the customer's **signed** copy, and each field carries a badge:
  *Customer-confirmed*, *State-prefilled* (or *State-prefilled, corrected by customer*), and *Changed after
  authorization: customer must reconfirm*. Without a signature, the badge is *Not yet confirmed*.
- **Blockers (server-enforced).** Mark ready, Start filing and Mark submitted are refused when:
  - the answers changed after signing;
  - there is no packet confirmation;
  - the agent changes and the consent isn't on file;
  - the order is unpaid or was a test payment.
- **Comparison checkpoint.** While the filing is in progress, the operator ticks *"I have compared the state filing
  against the customer-authorized filing packet."* This writes `filing.state_comparison_confirmed` (with the signed
  answers' hash) to the audit log. **Mark submitted is refused** without a checkpoint recorded after the latest
  signature for the same answers.
- **Printable packet** (`/admin/filings/<id>/packet`): the signed CCFS-order packet, the registered-agent consent
  record, and the Authorized Person block with the certification. It also shows the packet hash, the confirmation
  status and the filing agent.

### Operator steps in CCFS (Express Annual Report)

1. Open the packet. Confirm there are no blockers: current authorization, consent on file if needed, paid live order.
2. Open CCFS Express Annual Report: **with changes** if the packet changes anything on the record, **without changes**
   otherwise. Complete the Cloudflare check by hand. Search by UBI.
3. Read the status and expiration date. If the status is **Delinquent**, Washington adds $25. Pay it only if the
   order collected it; otherwise contact the customer first.
4. Work through the sections in order and make every value match the packet. In Controlling Interest, set each
   answer (they default to "No").
5. **Registered Agent Consent:** select a statement only if it is true and the consent is on file. Otherwise stop.
6. Effective Date: Date of Filing. Leave Return Address and Upload blank.
7. On the CCFS review screen, compare every value with the packet, then **record the checkpoint** in Filewell.
8. Authorized Person: type your name and tick the certification. Add to Cart, check out and pay by card.
9. Save the confirmation and the filed document, then Mark submitted and upload the document.

## The $25 delinquency fee

- It is charged only when Washington's **own dated record** (a CCFS export no older than 14 days) shows
  **Delinquent**.
- A date that has passed by Filewell's clock never adds it. Without a status, it is listed only as "possible".
- At filing, the operator reads CCFS. If CCFS charges $25 that the order didn't collect, the operator contacts the
  customer before paying.
- Tests (`tests/unit/wa-authorization.test.ts`):
  - timely, status unknown: $70;
  - past due, status unknown or Active: $70;
  - Delinquent per a dated record: $95;
  - records older than 14 days are never read.

## Verification done

- Unit and database tests (local): the packet order, conditional questions, consent rules, unchanged Pennsylvania
  wording, the blockers, the checkpoint, the fee cases, and the append-only signed packet.
- Preview browser tests (staging, sandbox payments only; nothing filed with the state):
  - **without changes**: packet, certification, a refused signature without the packet confirmation, $119
    checkout, operator provenance, checkpoint;
  - **with changes**: new agent with the signer's consent, an edit after signing that forces a new signature
    (both signatures kept), operator checkpoint.
- **CCFS itself was not walked through.** Its business search sits behind a Cloudflare Turnstile check that fails in
  an automated browser, and we never get around bot checks. The section order and wording come from the official
  form and online instructions. See the owner check below.

## Owner actions before turning Washington on

1. **15-minute CCFS check (no submission).** Open the Express Annual Report "with changes" page yourself and search
   a business whose report is due within 180 days. Your own customer's business, with their permission, is best.
   Click through to the review screen and confirm that the sections and order match the packet, including the
   wording of the Registered Agent Consent radio buttons. **Stop before Add to Cart.** Tell me anything that differs.
2. Counsel review of the authorization text (it now names you and quotes the certification) and of filing as an
   authorized agent under RCW 23.95.240.
3. Then switch Washington on (below), place one controlled real order, and cancel and refund it if it was a test.

## The switch (do not set without explicit owner instruction)

On Vercel, project `filewell`, Production environment only, add:

```
WA_LIVE_FILING_SALES=true
```

Then redeploy production. The price is already approved, so checkout opens for Washington. To turn it off again,
remove the variable or set it to `false` and redeploy.
