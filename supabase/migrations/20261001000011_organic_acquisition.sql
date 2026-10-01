-- Organic acquisition: voluntary reminder subscriptions, first/last-touch attribution,
-- a manual founder-research CRM and a referral-partner pipeline.
--
-- Additive and backward compatible: new tables only, plus a widened (superset)
-- analytics_events event list. Nothing here sends anything:
--   reminder_subscribers      people who typed their own email and confirmed (double opt-in)
--   reminder_suppressions     addresses that unsubscribed from reminders; only an explicit
--                             new opt-in that is confirmed again removes the row
--   subscriber_reminders      one row per reminder email planned/sent to a subscriber
--   subscriber_emails         a copy of each email sent to a subscriber
--   business_attribution      first/last touch captured when a business is added
--   founder_prospects         Amary's manual research notes on public register businesses
--   referral_partners         accountants, bookkeepers and similar firms (CRM only)
--
-- Access: service role only (RLS on, no policies, privileges revoked from anon and
-- authenticated). Admin pages read through the server after a staff check.

create table public.reminder_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  state_code text not null references public.states (code),
  entity_type text not null check (entity_type in (
    'llc', 'corporation', 'nonprofit_corporation', 'lp', 'llp',
    'electing_partnership', 'professional_association', 'business_trust', 'other')),
  is_foreign boolean not null default false,
  is_nonprofit boolean not null default false,
  legal_name text not null check (char_length(legal_name) between 1 and 300),
  entity_number text check (entity_number is null or entity_number ~ '^[A-Za-z0-9-]{1,30}$'),
  formation_date date,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'unsubscribed')),
  consent_text text not null check (char_length(consent_text) between 10 and 1000),
  consent_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  confirmation_sent_at timestamptz,
  attribution jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index reminder_subscribers_identity_idx
  on public.reminder_subscribers (email, state_code, coalesce(entity_number, lower(legal_name)));
create index reminder_subscribers_status_idx on public.reminder_subscribers (status);
create trigger reminder_subscribers_updated_at before update on public.reminder_subscribers
  for each row execute function public.set_updated_at();

create table public.reminder_suppressions (
  email text primary key check (char_length(email) between 3 and 254 and email = lower(email)),
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual')),
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now()
);

create table public.subscriber_reminders (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.reminder_subscribers (id) on delete cascade,
  due_date date not null,
  offset_days int not null,
  scheduled_for date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'failed')),
  skip_reason text check (skip_reason is null or char_length(skip_reason) <= 60),
  provider_message_id text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscriber_id, due_date, offset_days)
);
create index subscriber_reminders_due_idx on public.subscriber_reminders (status, scheduled_for);

-- A copy of every email sent to a subscriber (like notifications for customers).
create table public.subscriber_emails (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.reminder_subscribers (id) on delete cascade,
  kind text not null check (kind in ('confirmation', 'reminder')),
  subject text not null check (char_length(subject) <= 300),
  body_text text not null check (char_length(body_text) <= 20000),
  provider_message_id text,
  created_at timestamptz not null default now()
);
create index subscriber_emails_subscriber_idx on public.subscriber_emails (subscriber_id, created_at);

create table public.business_attribution (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attribution jsonb not null,
  created_at timestamptz not null default now()
);

create table public.founder_prospects (
  id uuid primary key default gen_random_uuid(),
  state_entity_record_id uuid not null unique references public.state_entity_records (id),
  list_date date not null,
  website_url text check (website_url is null or char_length(website_url) <= 500),
  contact_page_url text check (contact_page_url is null or char_length(contact_page_url) <= 500),
  business_phone text check (business_phone is null or char_length(business_phone) <= 40),
  linkedin_url text check (linkedin_url is null or char_length(linkedin_url) <= 500),
  status text not null default 'to_research' check (status in (
    'to_research', 'researched', 'no_public_contact', 'contacted', 'responded', 'not_interested', 'interested', 'converted', 'skipped')),
  contacted_on date,
  channel text check (channel is null or channel in ('phone', 'contact_form', 'linkedin', 'in_person', 'email_reply', 'other')),
  response text check (response is null or char_length(response) <= 1000),
  interested boolean,
  converted boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index founder_prospects_list_idx on public.founder_prospects (list_date);
create trigger founder_prospects_updated_at before update on public.founder_prospects
  for each row execute function public.set_updated_at();

create table public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  firm_name text not null check (char_length(firm_name) between 1 and 200),
  kind text not null check (kind in ('accountant', 'bookkeeper', 'tax_preparer', 'consultant', 'formation_service', 'other')),
  website_url text check (website_url is null or char_length(website_url) <= 500),
  public_contact text check (public_contact is null or char_length(public_contact) <= 300),
  status text not null default 'to_contact' check (status in ('to_contact', 'contacted', 'responded', 'interested', 'not_interested', 'active')),
  contacted_on date,
  response text check (response is null or char_length(response) <= 1000),
  ref_code text unique check (ref_code is null or ref_code ~ '^[a-z0-9-]{3,40}$'),
  notes text check (notes is null or char_length(notes) <= 2000),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger referral_partners_updated_at before update on public.referral_partners
  for each row execute function public.set_updated_at();

alter table public.reminder_subscribers enable row level security;
alter table public.reminder_suppressions enable row level security;
alter table public.subscriber_reminders enable row level security;
alter table public.subscriber_emails enable row level security;
alter table public.business_attribution enable row level security;
alter table public.founder_prospects enable row level security;
alter table public.referral_partners enable row level security;

revoke all on public.reminder_subscribers, public.reminder_suppressions, public.subscriber_reminders,
  public.subscriber_emails, public.business_attribution, public.founder_prospects, public.referral_partners
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Analytics: acquisition events (superset of the previous list)
-- ---------------------------------------------------------------------------
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_viewed', 'state_page_viewed', 'lookup_started', 'lookup_completed',
  'filing_cta_clicked', 'intake_started', 'intake_completed', 'checkout_started',
  'checkout_cancelled', 'payment_completed', 'reminder_clicked', 'filing_completed',
  'registry_search', 'registry_selected', 'prefill_applied', 'prefill_confirmed', 'outreach_clicked',
  'visit_started', 'reminder_opt_in', 'reminder_confirmed', 'reminder_unsubscribed', 'reminder_sent'));
create index if not exists analytics_events_lt_source_idx on public.analytics_events ((properties->>'lt_source'), event_name);
