-- State entity records, prefill provenance, and the (dry-run only) prospect outreach model.
--
-- Additive and backward compatible: new tables, plus a widened (superset) analytics_events
-- event_name check. No existing column changes; existing rows stay valid.
--
-- Separation (never mix marketing prospects into customer filing records):
--   state_entity_records  public registry data as retrieved from a named source
--   filing_prefill        per-filing, per-field provenance of prefilled intake values
--   prospects             businesses we MAY contact (not customers), each tied to a record
--   contact_points        how a prospect could be reached, each with its own source/licence
--   marketing_suppressions permanent do-not-contact list (unsubscribe, bounce, complaint)
--   marketing_campaigns   segment + exact content + approval; sending is gated in code
--   marketing_sends       one row per recipient per campaign (dry-run rows included)
--
-- Access: all service role only (RLS on, no policies, privileges revoked from anon and
-- authenticated), except filing_prefill, which a customer may read for their own filings.

-- ---------------------------------------------------------------------------
-- state_entity_records
-- ---------------------------------------------------------------------------
create table public.state_entity_records (
  id uuid primary key default gen_random_uuid(),
  state_code text not null references public.states (code),
  entity_number text not null check (entity_number ~ '^[A-Za-z0-9-]{1,30}$'),
  legal_name text not null check (char_length(legal_name) between 1 and 300),
  entity_type_raw text check (entity_type_raw is null or char_length(entity_type_raw) <= 200),
  entity_type text check (entity_type is null or entity_type in (
    'llc', 'corporation', 'nonprofit_corporation', 'lp', 'llp',
    'electing_partnership', 'professional_association', 'business_trust', 'other')),
  is_foreign boolean,
  status_raw text check (status_raw is null or char_length(status_raw) <= 100),
  formation_date date,
  jurisdiction_of_formation text check (jurisdiction_of_formation is null or char_length(jurisdiction_of_formation) <= 100),
  registered_office jsonb,
  principal_office jsonb,
  governors jsonb,
  officers jsonb,
  -- Annual reports the source shows as filed, e.g. [{"year": 2026, "filed_on": "2026-05-02"}].
  -- NULL means the source does not say (unknown), never "not filed".
  annual_reports jsonb,
  source text not null check (char_length(source) between 1 and 100),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  source_licence text check (source_licence is null or char_length(source_licence) <= 500),
  retrieved_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, entity_number, source)
);
create index state_entity_records_name_idx on public.state_entity_records (state_code, lower(legal_name));
create trigger state_entity_records_updated_at before update on public.state_entity_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- filing_prefill: provenance of each prefilled intake field
-- ---------------------------------------------------------------------------
create table public.filing_prefill (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z_]{1,60}$'),
  source text not null check (source in ('state_registry', 'previous_filing', 'business_profile')),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  state_entity_record_id uuid references public.state_entity_records (id) on delete set null,
  retrieved_at timestamptz not null,
  original_value jsonb not null,
  confirmed_value jsonb,
  edited boolean,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (filing_id, field_key)
);
create index filing_prefill_user_idx on public.filing_prefill (user_id);

-- ---------------------------------------------------------------------------
-- prospects and contact points
-- ---------------------------------------------------------------------------
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  state_entity_record_id uuid not null unique references public.state_entity_records (id) on delete cascade,
  state_code text not null references public.states (code),
  -- Set when the prospect becomes (or already is) a Filewell business: never marketed to again.
  converted_business_id uuid references public.businesses (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger prospects_updated_at before update on public.prospects
  for each row execute function public.set_updated_at();

create table public.contact_points (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  kind text not null check (kind in ('email', 'website', 'phone', 'postal')),
  value text not null check (char_length(value) between 3 and 320),
  -- Business contact only: role/generic business addresses, never personal data we inferred.
  is_business_contact boolean not null default true,
  source text not null check (char_length(source) between 1 and 100),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  -- What the source's licence allows (e.g. 'marketing_permitted', 'no_marketing', 'unknown').
  licence_use text not null default 'unknown' check (licence_use in ('marketing_permitted', 'no_marketing', 'unknown')),
  retrieved_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (prospect_id, kind, value)
);

-- ---------------------------------------------------------------------------
-- permanent suppression list (outreach)
-- ---------------------------------------------------------------------------
create table public.marketing_suppressions (
  email text primary key check (email = lower(email) and char_length(email) between 3 and 320),
  reason text not null check (reason in ('unsubscribe', 'bounce', 'complaint', 'manual', 'customer')),
  source text check (source is null or char_length(source) <= 200),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- campaigns and sends
-- ---------------------------------------------------------------------------
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  state_code text not null references public.states (code),
  segment text not null check (segment in ('approaching_deadline', 'deadline_passed_outstanding', 'unknown_status')),
  entity_group text not null default 'all' check (entity_group in ('all', 'llc', 'corporation', 'other')),
  subject text not null check (char_length(subject) between 1 and 150),
  -- Content is rendered from a fixed, reviewed template; only the subject is editable.
  template_key text not null default 'pa_annual_report_reminder' check (template_key in ('pa_annual_report_reminder')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'paused', 'archived')),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  -- Fingerprint of the exact subject/body/segment that was approved; any change voids approval.
  approved_content_sha256 text check (approved_content_sha256 is null or approved_content_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger marketing_campaigns_updated_at before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

create table public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  contact_point_id uuid references public.contact_points (id) on delete set null,
  email text check (email is null or email = lower(email)),
  status text not null check (status in ('dry_run', 'queued', 'sent', 'skipped', 'failed')),
  reasons text[] not null default '{}',
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  clicked_at timestamptz,
  unsubscribed_at timestamptz,
  converted_business_id uuid references public.businesses (id) on delete set null,
  revenue_cents integer not null default 0 check (revenue_cents >= 0),
  created_at timestamptz not null default now(),
  unique (campaign_id, prospect_id)
);
create index marketing_sends_campaign_idx on public.marketing_sends (campaign_id, status);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
alter table public.state_entity_records enable row level security;
alter table public.filing_prefill enable row level security;
alter table public.prospects enable row level security;
alter table public.contact_points enable row level security;
alter table public.marketing_suppressions enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_sends enable row level security;

revoke all on public.state_entity_records, public.prospects, public.contact_points,
  public.marketing_suppressions, public.marketing_campaigns, public.marketing_sends
  from anon, authenticated;
revoke all on public.filing_prefill from anon;
revoke insert, update, delete on public.filing_prefill from authenticated;
grant select on public.filing_prefill to authenticated;

-- A customer reads the provenance of their own filings; staff read all. Writes: service role.
create policy filing_prefill_read on public.filing_prefill for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Analytics: prefill and outreach events (superset of the previous list)
-- ---------------------------------------------------------------------------
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_viewed', 'state_page_viewed', 'lookup_started', 'lookup_completed',
  'filing_cta_clicked', 'intake_started', 'intake_completed', 'checkout_started',
  'checkout_cancelled', 'payment_completed', 'reminder_clicked', 'filing_completed',
  'registry_search', 'registry_selected', 'prefill_applied', 'prefill_confirmed', 'outreach_clicked'));
