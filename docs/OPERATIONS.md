# Operations runbook: Pennsylvania annual report (manual fulfillment)

This is how one operator fulfils Pennsylvania annual report orders today.

## Before the first order

1. **Business Filing Services account.** Create the company's own login at
   <https://file.dos.pa.gov> (it signs in through the PA Business Hub, which uses
   Keystone Login). Use a shared operations mailbox, not a personal email.
2. **Payment card for state fees.** A company card for the $7 state fee (nonprofits: $0).
   The customer's payment already covers it; the state fee is recorded separately on
   each order.
3. **Staff access.** `npm run grant-staff -- operator@company.com operator`
   (admins can also refund and change prices).

## Daily routine

1. Open `/admin` (Today). Handle anything under **Critical exceptions** first:
   filings due within 3 days, payments flagged for review, webhook errors, failed reminders.
2. Open `/admin/queue` (default: active orders sorted by deadline).

## Filing one order

1. Open the order. Check **Payment** is `Paid` and **Authorization** is recorded.
2. Review the submitted information. If something is missing or looks wrong, use
   **Request customer information** (the customer is emailed, and the order moves to
   *Needs customer action*). Otherwise click **Mark ready to file**.
3. Click **Open filing packet**. Keep it open next to the state site.
4. Click **Start filing**, then **Open official filing site**:
   - Log in to file.dos.pa.gov → **Business Search** → find the entity (use the entity
     number in the packet, or look it up on the public search).
   - Click **File Annual Report** (no PIN needed).
   - Confirm or update each field so it matches the packet exactly: registered office or
     CROP + county, principal office, governor(s), principal officers.
   - Tick the declarations, e-sign with the signature wording in the packet, pay the fee.
5. Online reports are approved automatically, usually within minutes. **Download the filed
   Form and the Acknowledgement Letter immediately**: the state keeps them only 60 days.
6. Back in the order: **Mark submitted** with the state confirmation number and date.
7. **Upload** the filed report and acknowledgement (kind: *Filed report* / *Acknowledgement*,
   visible to customer).
8. **Mark accepted**. With documents on file the order completes automatically: the
   customer is emailed, the documents appear in their dashboard, that period's reminders
   stop, and next year's requirement is opened.

## Problems

- **Rejected by the state:** **Mark rejected** with the reason (customer is emailed), fix,
  then **Reopen** → file again.
- **Customer wants to cancel before filing:** **Cancel** (reason), then **Refund** (admins).
  After submission the state fee is not refundable (state fees are nonrefundable).
- **Duplicate payment** (flagged in `/admin/payments`): refund the duplicate payment.
- **Webhook errors:** `/admin/payments` lists events that failed processing; the processor
  retries automatically, and processing is idempotent.

## Things you must never do

- Never file anything the customer has not authorized.
- Never change an order's status outside the console (every change is audited).
- Never tell a customer their business "will be dissolved" unless a published rule says so.
  For Pennsylvania: no late fee; dissolution/termination applies starting with reports due
  in 2027, six months after the due date.
