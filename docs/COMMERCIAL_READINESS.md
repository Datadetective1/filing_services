# Commercial readiness: what still stands between Filewell and selling

Written 2026-10-28 on branch `commercial-readiness/2026-10`. Filewell already takes live
payments for Pennsylvania annual reports (live on Production since 2026-09-30; see
[FIRST_CUSTOMER_READINESS.md](FIRST_CUSTOMER_READINESS.md)). This page lists every
remaining gate to selling it. The live state of most rows is on `/admin` → System status →
**Ready to sell** (admins only, read only).

Pennsylvania is the only state for sale. Washington, Nevada and Utah stay closed to sales
(fail closed in code) and are not part of this list.

## 1. Owner fields

Only the owner (with counsel or a tax adviser where named) can settle these. Nothing in
code or docs fills them in, and no value below is a guess.

| Field | Where it lives | Value |
| --- | --- | --- |
| Legal operator | NEXT_PUBLIC_LEGAL_ENTITY (Vercel Production) | [OWNER TO CONFIRM: keep "Amary Coulibaly, sole proprietor" or name another entity] |
| Governing law | NEXT_PUBLIC_GOVERNING_LAW (Vercel Production) | [OWNER TO CONFIRM: governing law, or leave the clause out] |
| Postal address for notices and email footers | NEXT_PUBLIC_POSTAL_ADDRESS (Vercel Production) | [OWNER TO CONFIRM: a publishable postal address, or keep "available on request"] |
| Attorney review of legal pages | Draft banner in legal-page.tsx | [OWNER TO CONFIRM: sell under the draft, or get attorney review first] |
| Trade name | none | [OWNER TO CONFIRM: whether "Filewell" must be registered as a fictitious name] |
| Signing PA reports | packet signature wording | [OWNER TO CONFIRM: counsel's view on e-signing as authorized representative, signer name and title] |
| Sales tax on the $49 service fee | Stripe Tax (off) | [OWNER TO CONFIRM: taxable or not, per a tax adviser] |
| Production-only secrets | Vercel Production env | [OWNER TO CONFIRM: APP_SIGNING_SECRET, IP_HASH_SALT, CRON_SECRET given their own Production values] |
| Stripe account time zone | Stripe dashboard | [OWNER TO CONFIRM: set to Eastern, or confirm already done] |
| Late 2026 PA reports | official source | [OWNER TO CONFIRM: whether PA accepts a 2026 report after Dec 31, from the Department of State] |

What each one changes today:

- **Governing law** unset: the terms omit the clause entirely (no placeholder) and Contact
  is section 17. Set: section 17 is Governing law and Contact is section 18.
- **Postal address** unset: legal pages say the address is "available on request from
  support@getfilewell.com", and every subscriber reminder (the free reminder emails for
  non-customers) is skipped with reason `no_postal_address`. Set: reminders are sent and
  the address appears in every email footer.
- **Legal operator** unset on a deployment: legal pages show a bracketed placeholder.
- Any change to the text of a legal page must move `LEGAL_LAST_UPDATED` in
  `src/lib/seo/legal.ts` with it (it versions every customer's authorization). That is not
  part of this branch.

Also still open in [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md): repository visibility, 2FA on
every account and branch protection on `main` (critic-01), and the search-indexing gates
(owner's written approval, then OPERATIONS.md "Turning on indexing").

## 2. Engineering items from this branch

| Status | Item | Where |
| --- | --- | --- |
| Done | "Ready to sell" panel on `/admin` → System status (admins only, read only, no secret values): live payments and provider, approved price per sellable state, legal entity, governing law, postal address, legal review, legal pages version, search indexing, sales tax, production-only secrets | `src/lib/admin/sell-readiness.ts`, `src/app/admin/page.tsx`, `tests/unit/sell-readiness.test.ts` |
| Done | Tests that lock in the env-driven legal fields: terms section numbering with and without governing law, postal address wording, the subscriber reminder skip (`no_postal_address`), the postal address in the reminder email footer, the legal entity placeholder. No behavior change; the footer already carries the address | `tests/unit/legal-env-fields.test.ts` |
| Done | Every PA entity type due Dec 31 can be bought end to end on the sandbox: lp, llp, electing_partnership, professional_association, business_trust ($7 + $49 = $56) and a not-for-profit LP ($49). Quote, order totals, approved price lookup, checkout start once authorized, paid order to the operator's review; one Playwright journey for an LP to the operator queue. No wiring bug found | `tests/db/dec31-entities.test.ts`, `tests/unit/dec31-checkout.test.ts`, `tests/e2e/dec31-lp.spec.ts` |
| Done | Homepage hero shows the PA rule whose next verified due date is soonest (Dec 31: limited partnership), and "Have us file it" carries the same entity | `src/lib/seo/hero-rule.ts`, `tests/unit/hero-rule.test.ts`, `tests/e2e/hero-deadline.spec.ts` |
| Done | LAUNCH_CHECKLIST.md and OPERATIONS.md payments and Stripe rows match FIRST_CUSTOMER_READINESS.md (live since 2026-09-30, card and Link only, test charge refunded, past-due Stripe items cleared) | `docs/LAUNCH_CHECKLIST.md`, `docs/OPERATIONS.md` |
| Pending | Staff email for stuck payments (payments flagged for review), one per case per day, from the daily cron | see Change 6 in the branch's PR |

Nothing on this branch is deployed to production, changes an environment variable, adds a
migration, or touches live Stripe.
