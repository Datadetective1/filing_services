# Organic acquisition playbook ($0 paid media)

Prepared 2026-10-01. Postcards stay off (`MAIL_SENDS_ENABLED` unset), cold email stays off
(`MARKETING_SENDS_ENABLED` unset), nothing is bought.

## What the site does now

- **Search first.** The homepage hero, `/find` and every Pennsylvania guide have the register
  search. Flow: search, then "Pennsylvania record found", then options. The options are: file it
  yourself for $7, free reminders, or have Filewell file it (account, prefilled draft, authorize,
  checkout).
- **Free reminders.** On the result page, without an account. The email box and consent box
  start empty and unticked; this is double opt-in. Up to three emails a year (about 60, 30 and
  7 days before the due date).
  - Every email has a one-click unsubscribe. An unsubscribe is permanent, and only a new opt-in
    that is confirmed again lifts it.
  - Subscriptions are never created from public records.
  - Reminder emails are skipped until `NEXT_PUBLIC_POSTAL_ADDRESS` is set (CAN-SPAM). The
    confirmation email still goes out.
- **Guides.** `/pennsylvania/annual-report-deadline`, `/pennsylvania/annual-report-fee`,
  `/pennsylvania/how-to-file-annual-report`, `/pennsylvania/annual-report-after-deadline` and
  `/pennsylvania/business-search`. All use official sources checked on 2026-10-01; to update
  them, edit `src/lib/seo/pa-guides.ts`.
- **Attribution.** First and last touch: source, medium, campaign, referrer domain, landing page.
  - Stored in a first-party cookie, which is skipped when the browser sends Global Privacy Control.
  - Recorded on funnel events, kept with each business and carried through to payment.
  - Tag your links with `?utm_source=linkedin&utm_campaign=launch`. Give partner links as
    `?ref=<code>`.
- **Admin.**
  - `/admin/acquisition`: funnel and conversion by source.
  - `/admin/acquisition/prospects`: the daily research list.
  - `/admin/acquisition/partners`: the referral partner pipeline.

## Google Search Console (Amary, about 10 minutes)

Your DNS is on Cloudflare, so use a **Domain** property (it covers www and apex).

1. Open https://search.google.com/search-console and sign in with the Google account that
   should own the site.
2. Open the property menu (top left), click **Add property**, choose **Domain**, type
   `getfilewell.com`, then **Continue**.
3. Google shows a TXT record.
   - If it offers **Start verification** for Cloudflare, click it, sign in to Cloudflare and
     click **Authorize**.
   - Otherwise click **Copy**. Then go to dash.cloudflare.com, open **getfilewell.com**, then
     **DNS**, then **Records**, then **Add record**. Set Type to `TXT`, Name to `@`, Content to the
     copied value and TTL to Auto, then click **Save**.
4. Back in Search Console, click **Verify**. If it fails, wait 5 to 10 minutes and try again.
5. In the left menu go to **Indexing**, then **Sitemaps**. Under "Add a new sitemap" enter
   `https://www.getfilewell.com/sitemap.xml` and click **Submit**. The status should read
   "Success".
6. Click **URL inspection** at the top. Paste each URL, wait, then click **Request indexing**:
   - `https://www.getfilewell.com/`
   - `https://www.getfilewell.com/annual-report/pennsylvania`
   - `https://www.getfilewell.com/pennsylvania/annual-report-deadline`
   - `https://www.getfilewell.com/pennsylvania/annual-report-fee`
   - `https://www.getfilewell.com/pennsylvania/how-to-file-annual-report`
   - `https://www.getfilewell.com/pennsylvania/annual-report-after-deadline`
   - `https://www.getfilewell.com/pennsylvania/business-search`

Fallback if you can't touch DNS: add a **URL prefix** property for `https://www.getfilewell.com`
and choose **HTML tag**. Copy only the `content="..."` value and set it as
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel (Production), or send it to Claude. After it
redeploys, click **Verify**.

## Bing Webmaster Tools (Amary, about 5 minutes, after Google)

1. Open https://www.bing.com/webmasters and sign in.
2. Under "Import from Google Search Console" click **Import**, then **Continue**. Sign in with the
   same Google account, click **Allow**, tick `getfilewell.com` and click **Import**. Bing copies
   the verification and the sitemap.
3. In the left menu click **Sitemaps**. If `https://www.getfilewell.com/sitemap.xml` isn't
   listed, click **Submit sitemap**, paste it and click **Submit**.
4. In the left menu click **URL Submission** and paste the same seven URLs listed above.

Manual alternative: click **Add your site manually**, enter `https://www.getfilewell.com` and
click **Add**. Choose **HTML Meta Tag**, copy the `content` value and set it as
`NEXT_PUBLIC_BING_SITE_VERIFICATION` in Vercel (Production). Redeploy, then click **Verify**.

## Daily founder routine (about 45 minutes)

1. Go to `/admin/acquisition/prospects` and click **Build today's list** (20 businesses whose
   filing period is closest; today that's LPs and similar, due December 31).
2. For each one, use only public business channels: the business's own website, contact form,
   business phone or company page. Record what you find.
3. If there is a sensible public channel, send one short, personal message (template below).
   Never bulk-send, never email scraped or guessed addresses, and don't follow up unless they
   reply.
4. Log the date, channel and response. Mark "Became a customer" when they buy.

Never say a report is unfiled, late or out of compliance: the register doesn't show that. Say
"may be due".

## Drafts (not published or sent)

### LinkedIn launch post

> I've been building something small and specific: Filewell, a filing service for
> Pennsylvania's annual report.
>
> Since 2025, most Pennsylvania LLCs, corporations and partnerships file a short annual report
> with the Department of State every year. Filing it yourself at file.dos.pa.gov costs $7, and
> plenty of owners should do exactly that.
>
> Filewell is for people who'd rather hand it off. Search your business, we fill in what the
> state's public register shows, you check it, and we file it: $49 plus the $7 state fee. Or
> just get free reminders before your due date and file it yourself.
>
> What I care about: we're a private company, not the state. No official-looking mail, no
> scare tactics, and no "late fees" that don't exist (Pennsylvania doesn't charge one).
>
> If you own a Pennsylvania business, or advise people who do, I'd really value your honest
> feedback: https://www.getfilewell.com/?utm_source=linkedin&utm_campaign=launch

### LinkedIn follow-up post

> A quick Pennsylvania annual report calendar, since it confuses a lot of owners:
>
> Corporations by June 30. LLCs by September 30. LPs, LLPs, business trusts and the rest by
> December 31. The filing window opens January 1, and a new business files the year after it
> forms.
>
> Missed September 30 for your LLC? It can still be filed, and the state charges no late fee.
> The Department of State says administrative dissolution applies starting with reports due in
> 2027, six months after the due date.
>
> I wrote it up with links to every official source:
> https://www.getfilewell.com/pennsylvania/annual-report-deadline?utm_source=linkedin&utm_campaign=followup

### Reddit / community feedback post

Check each community's self-promotion rules first, and post only where founders asking for
feedback is allowed (for example a weekly feedback thread).

> **Founder looking for honest feedback on a Pennsylvania annual report tool**
>
> Disclosure: I built this. Pennsylvania started requiring annual reports in 2025 ($7 if you
> file yourself at file.dos.pa.gov). I made a site where you search your business, see when the
> report may be due, and either file it yourself, get free reminders, or pay us to file it.
>
> I'm trying hard to avoid the official-looking-mail vibe some filing services have. Two
> questions: does the page make it clear we're not the state? And is anything confusing about
> the options? https://www.getfilewell.com/?utm_source=reddit&utm_campaign=feedback
>
> Happy to take criticism.

### Short founder-to-business-owner message (public contact form or call)

> Hi, I'm Amary. I run Filewell, a small Pennsylvania filing service. Businesses like
> [Business name] file a Pennsylvania annual report each year, and for partnerships it may be
> due by December 31. You can file it yourself at file.dos.pa.gov for $7. If you'd rather hand
> it off, we do it for $49 plus the $7 state fee, or I can set you up with free reminders.
> We're a private company, not the state. If it's not useful, no reply needed and I won't
> follow up. https://www.getfilewell.com/?utm_source=outreach

### Short accountant / bookkeeper message

> Hi [Name], I'm Amary, founder of Filewell. Pennsylvania's annual report is a small, recurring
> chore for your business clients ($7 if they file it themselves). For clients who'd rather not
> deal with it, Filewell files it for $49 plus the state fee, and anyone can get free reminders.
> No referral fees or contracts. If it's useful I'll give you a link that shows which clients
> came from you. Happy to walk you through it in 10 minutes.
> https://www.getfilewell.com/?ref=[code]
