-- Registered Agents Inc. new-document alerts.
--
-- The partner posts a signed alert (document ID, company ID, company name) when a document
-- arrives for one of our entities. The alert carries no file, so it can't become a
-- service_documents row by itself: it is recorded here, staff pull the document from the
-- partner portal and upload it, and the upload is linked back to the alert.
--   * One row per partner document: a retried or replayed alert is a no-op.
--   * Only the server writes; staff read. Customers never see these rows.

create table public.provider_document_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'registered_agents_inc' check (provider in ('registered_agents_inc')),
  provider_document_id text not null check (char_length(provider_document_id) between 1 and 200),
  provider_company_id text check (provider_company_id is null or char_length(provider_company_id) <= 100),
  provider_company_name text check (provider_company_name is null or char_length(provider_company_name) <= 300),
  match_status text not null check (match_status in ('matched', 'unmatched', 'ambiguous')),
  ra_subscription_id uuid references public.ra_subscriptions (id),
  user_id uuid references auth.users (id),
  business_id uuid references public.businesses (id),
  received_at timestamptz not null default now(),
  customer_notified_at timestamptz,
  reminder_sent_at timestamptz,
  service_document_id uuid references public.service_documents (id) on delete set null,
  handled_at timestamptz,
  handled_by uuid references auth.users (id),
  handled_note text check (handled_note is null or char_length(handled_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_document_events_unique unique (provider, provider_document_id),
  constraint provider_document_events_matched_has_subscription check (
    (match_status = 'matched') = (ra_subscription_id is not null)
  ),
  constraint provider_document_events_matched_has_owner check (
    ra_subscription_id is null or (user_id is not null and business_id is not null)
  )
);

create index provider_document_events_open_idx on public.provider_document_events (received_at)
  where handled_at is null;
create index provider_document_events_subscription_idx on public.provider_document_events (ra_subscription_id, received_at desc);
create index provider_document_events_company_idx on public.provider_document_events (provider, provider_company_id);

create trigger provider_document_events_updated_at before update on public.provider_document_events
  for each row execute function public.set_updated_at();

-- The partner's company ID is how an alert finds its subscription; two subscriptions with
-- the same ID would make every alert for that company ambiguous.
create unique index ra_subscriptions_provider_account_ref_unique on public.ra_subscriptions (provider, provider_account_ref)
  where provider_account_ref is not null;

alter table public.provider_document_events enable row level security;
create policy provider_document_events_select on public.provider_document_events for select to authenticated
  using ((select public.is_staff()));
revoke all on public.provider_document_events from anon;
revoke insert, update, delete on public.provider_document_events from authenticated;
