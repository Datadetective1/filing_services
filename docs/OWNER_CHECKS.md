# Owner checks: Washington, Nevada, Utah

Everything that doesn't need a person is built and tested. This page is the human part, in the order to do it.
**Never submit, pay, create a filing or accept terms on behalf of a client during these checks.** Stop before payment
every time.

---

## 1. Washington: live portal comparison sheet (about 15 minutes)

Open https://ccfs.sos.wa.gov → **Express Annual Report with changes**. Complete the Cloudflare check yourself. Search a
business that is due within 180 days: your first customer's (with their permission), or any active WA business. Work
down the table. Tick ✓ if it matches, or write what CCFS shows. **Stop before "Add to Cart".**

| # | CCFS screen / section | Filewell expects | Packet field | Mismatch if… | ✓ |
|---|---|---|---|---|---|
| 1 | Express Annual Report search | Search by UBI (9 digits; spaces OK) | UBI number | Search needs something besides UBI/name | |
| 2 | Business Information | Name + UBI shown read-only | Business name, UBI number | Section missing or editable | |
| 3 | Registered Agent | Current agent shown; you can edit, or replace it as **Commercial** or **Noncommercial** | Change / Agent type / Name / WA street address / Email | No commercial vs. noncommercial choice, or extra required fields | |
| 4 | Registered Agent Consent | Radio buttons appear when the agent changes. The state says selecting one means "the submitter is attesting to the statements listed" | (consent record on file) | **Copy the exact wording of each radio button here:** ____ | |
| 5 | Principal Office | Physical address (no PO box) + **email required**; phone/mailing optional | Principal office address, Email | Email not required, or new required fields | |
| 6 | Governors | Add/remove, individual or entity | Governors | Different structure (e.g. titles required) | |
| 7 | Nature of Business | Drop-down **or** "other" + text | Nature of business | No "other" text option | |
| 8 | Effective Date | "Date of Filing" option | Effective date = Date of Filing | No such option | |
| 9 | Controlling Interest | 4 questions (1, 2, 2a, 3), all default **No** | 1, 2, 2a, 3 | Different questions, wording or defaults | |
| 10 | Return Address for this Filing | Optional | Leave blank | Required | |
| 11 | Upload additional documents | Optional | Leave blank | Required | |
| 12 | Authorized Person | Name + checkbox: "This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct." | Authorized person and certification | **Different certification wording** (copy it) | |
| 13 | Review → Add to Cart | Review page lists all of the above | (comparison checkpoint) | Review omits a section | **STOP here** |
| 14 | Fee | $70 (+$25 only if Delinquent) | Government fee | Any other fee shown | |

Report back by sending this table with any ✗ notes and the exact text for rows 4 and 12. If rows 4 and 12 match and
nothing else is ✗, the walkthrough is done.

---

## 2. Washington: authorization text for counsel review

This is exactly what a Washington customer signs. Version `2026-10-01.v2.state1` is generated from the shipped code.
`[Business legal name]` is filled in from the customer's confirmed answers.

**Operator identity:** "Amary Coulibaly, sole proprietor, doing business as Filewell", from the production setting
`NEXT_PUBLIC_LEGAL_ENTITY`. Production refuses a Washington signature if this isn't set.

**Authorization text (the scrollable box above the checkboxes):**

> I confirm that I am authorized to act on behalf of [Business legal name]. I authorize Amary Coulibaly, sole proprietor, doing business as Filewell, and its personnel to act as the business's authorized representative for the limited purpose of preparing, electronically signing and submitting the Washington Annual Report described above, using the information I provided, and to pay the state filing fee on the business's behalf from the amount I pay for this order. I have reviewed every item of the Washington filing information shown above, in the order the state's form asks for it, and I confirm that each item is true, correct and complete. I understand that Amary Coulibaly, sole proprietor will sign the Annual Report as the business's authorized person and, relying on my confirmation, will make the state's certification: “This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct.” If any of this information changes, I will review and sign again before it is filed. I attest that the information I provided is true, correct and complete to the best of my knowledge. I understand that Filewell is a private filing service, is not a government agency, does not provide legal advice, and that I could instead file directly with the state. I agree to Filewell's Terms of Service and Refund Policy, last updated October 1, 2026.

**Required checkboxes (all three must be ticked; the customer also types their full name and title):**
1. "I reviewed every item of the Washington filing information above and it is true and correct. I understand Amary Coulibaly, sole proprietor will certify to the state, relying on my confirmation: “This document is hereby executed under penalty of law and is to the best of my knowledge, true and correct.”"
2. "I confirm the information above is accurate and complete."
3. "I authorize Filewell to act for the business as described in the authorization above, and I agree to the Terms of Service and Refund Policy."

**Registered-agent consent.** This only applies when the customer says the agent changes (a new agent, or a new street
address). Changes to contact details alone need no consent. The customer must choose one of two options:
- "I am the registered agent (or I sign for the business or position that serves as the agent), and I consent below."
  They then tick Washington's statement, verbatim: "I hereby consent to serve as Registered Agent in the State of
  Washington for the named business. I understand it will be my responsibility to accept service of process, notices,
  and demands on behalf of the business; to forward mail to the business; and to immediately notify the Office of the
  Secretary of State if I resign or change the Registered Office Address." It is stored with their name, title and the
  time.
- "Someone else is the agent. I'll send their signed Washington consent to serve; you won't file until you have it."
  Filing is blocked until staff upload the agent-signed consent. Filewell never selects a consent statement in CCFS
  without one.

**Re-authorization after edits.** Every signature is a new record that can never be changed. Any edit after signing:
- is logged with the old and new values;
- sends the customer back to Review ("Your details changed after you signed");
- blocks payment and filing until they sign again.

The operator files only the signed copy. Before certifying in CCFS, the operator records "I have compared the state
filing against the customer-authorized filing packet."

**Questions for counsel:**
1. Does this authorization let you, as a sole proprietor, act as the "authorized person" under RCW 23.95.240, and make
   the CCFS certification based on the customer's confirmation?
2. Is the consent handling enough under RCW 23.95.415?

---

## 3. Nevada: call to the Secretary of State (about 10 minutes)

Call Commercial Recordings at **(775) 684-5708** (sosmail@sos.nv.gov). Ask only these questions:

1. "A filing service files the **annual list and State Business License** for client LLCs, LPs and LLPs with written
   client authorization. NRS 76.100(3) says the business license application is signed by a manager or managing
   member, general partner, or managing partner, but your July 2026 form says an authorized natural person may sign.
   **Will you accept the combined filing signed by the client's authorized filing agent for an LLC, LP or LLP?**"
   *(If no, Filewell can't sell Nevada LLCs, LPs or LLPs. It could still sell corporations, where the statute allows an
   authorized person.)*
2. "In ORION, can a filing service's account file an annual list for **any** entity, or does it first need a
   **client PIN, an authorization code, a linked entity, or a service-company account**? How does a client grant
   that?"
3. "Is the **2.5% card fee** charged on annual list and business license payments? Is a trust account or ACH available
   to avoid it?" *(This changes our cost per order.)*

Write down each answer in one line, with the date and the name of the person you spoke to. Send them to me and I'll
update the rules and close the open questions in code.

## 4. Nevada: ORION walkthrough (about 10 minutes)

1. Go to https://orion.nv.gov. Sign in with your SilverFlume login, or click **Register New Account** (in your own
   name; the username can't be changed later). Note which identity checks it asks for.
2. Open **Renew Your Business → File Annual List and/or State Business License**. Search any active Nevada LLC by name.
   - **Report:** does it ask for a PIN, an authorization code or "link business" before showing the list? (yes/no + the exact prompt)
3. If it opens, click through to the declaration and signature screen. **Report:**
   - the order of the screens (compare with the packet: type of filing → exemption → entity → optional info → business location → investigation disclosure → management → declaration/signature);
   - the exact declaration wording;
   - whether the signer **title** list includes an option for an authorized person or agent.
4. **Report** the fees shown ($150 + $200 for an LLC) and whether a card fee is added. **Stop before Pay and Submit.**

---

## 5. Utah: call to the Division of Corporations (about 10 minutes)

Call **(801) 530-4849**. Ask only these questions:

1. "Under S.B. 40, effective October 1, **on what date does the $10 late fee now apply** to an annual report? Is it the
   day after the last day of the anniversary month, or later?"
2. "How are renewals **whose anniversary month is around the transition** (September–November 2026) handled? Is anything
   different for their due date or late fee?"
3. "How does a **third-party filing service** file an annual report for a customer with its own UtahID?"
4. "Does the customer need to set up **Filing Authority / add us as a designated user**, or give any other
   authorization? And which **signer title** should an authorized filing agent choose on the signature page?"

Write down one line per answer, with the date and the name of the person you spoke to, and send them to me.

## 6. Utah: UtahID portal walkthrough (about 10 minutes)

1. Create a UtahID (your name) and sign in at https://businessregistration.utah.gov.
2. Open **Renewals** (or whatever it's now called; **report the exact menu names**) → **Annual Report with changes**.
   Search any active Utah LLC.
   - **Report:** does Filing Authority block you? (exact message)
3. Click through and **report:**
   - the order of the screens (compare with the packet: entity search → purpose → principal office/email → registered agent → principal information → upload → signature);
   - **the exact attestation, authorization and acknowledgement checkbox wording** on the signature page;
   - the title options in the signature dropdown;
   - the fee shown, including any late fee.
4. **Stop before Add to Shopping Cart.**
