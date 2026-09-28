-- Filewell core schema
-- Conventions:
--   * Every tenant-owned row carries the owning auth user id (user_id / owner_user_id)
--     so row-level security can be evaluated without joins where possible.
--   * Money is stored in integer cents. Government fees and our service fees are
--     always stored separately and never blended.
--   * Compliance facts are versioned (state_rule_versions). Filings freeze the exact
--     version they were ordered under (rule_version_id + rule_snapshot).

-- gen_random_uuid() is built in (Postgres 13+); no extension required.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reference data: states, agencies, filing types, compliance rules
-- ---------------------------------------------------------------------------

create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z-]+$'),
  timezone text not null default 'America/New_York',
  -- manual: operator files by hand from a generated packet
  -- assisted: parts of the filing are automated, operator confirms
  -- automated: filed by integration; operators handle exceptions only
  support_level text not null default 'unsupported'
    check (support_level in ('unsupported', 'manual', 'assisted', 'automated')),
  filing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger states_updated_at before update on public.states
  for each row execute function public.set_updated_at();

create table public.state_agencies (
  id uuid primary key default gen_random_uuid(),
  state_code text not null unique references public.states (code),
  name text not null,
  website_url text not null check (website_url ~ '^https://'),
  business_search_url text check (business_search_url is null or business_search_url ~ '^https://'),
  periodic_report_name text,
  source_url text,
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'unverified')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger state_agencies_updated_at before update on public.state_agencies
  for each row execute function public.set_updated_at();

create table public.filing_types (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  description text,
  category text not null default 'periodic'
    check (category in ('periodic', 'tax', 'registered_agent', 'formation', 'amendment',
                        'certificate', 'dissolution', 'monitoring', 'other')),
  launch_enabled boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique, -- e.g. PA:annual_report:llc
  state_code text not null references public.states (code),
  filing_type_code text not null references public.filing_types (code),
  entity_type text not null check (entity_type in (
    'llc', 'corporation', 'nonprofit_corporation', 'lp', 'llp',
    'electing_partnership', 'professional_association', 'business_trust', 'other')),
  applies_to text not null default 'domestic_and_foreign'
    check (applies_to in ('domestic', 'foreign', 'domestic_and_foreign')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  unique (state_code, filing_type_code, entity_type, applies_to)
);

create table public.state_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.compliance_rules (id) on delete restrict,
  version int not null check (version > 0),
  verification_status text not null check (verification_status in ('verified', 'unverified')),
  publication_status text not null default 'published'
    check (publication_status in ('draft', 'published', 'superseded')),
  effective_from date not null,
  effective_to date,
  filing_name text not null,
  form_number text,
  due_rule jsonb not null,
  first_due_rule jsonb not null default '{"kind":"year_after_formation"}',
  state_fee_cents int not null check (state_fee_cents >= 0),
  nonprofit_state_fee_cents int check (nonprofit_state_fee_cents is null or nonprofit_state_fee_cents >= 0),
  late_fee_cents int check (late_fee_cents is null or late_fee_cents >= 0),
  late_fee_summary text,
  consequence_summary text,
  who_must_file text,
  required_information jsonb not null default '[]',
  intake_schema jsonb not null default '{}',
  official_filing_url text check (official_filing_url is null or official_filing_url ~ '^https://'),
  official_info_url text check (official_info_url is null or official_info_url ~ '^https://'),
  filing_method_summary text,
  processing_summary text,
  customer_summary text,
  faq jsonb not null default '[]',
  content_hash text not null,
  last_verified_at timestamptz,
  verified_by text,
  notes text,
  created_at timestamptz not null default now(),
  unique (rule_id, version)
);

alter table public.compliance_rules
  add constraint compliance_rules_current_version_fk
  foreign key (current_version_id) references public.state_rule_versions (id);

create table public.state_rule_sources (
  id uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references public.state_rule_versions (id) on delete restrict,
  fact_key text not null,
  url text not null check (url ~ '^https://'),
  title text,
  publisher text,
  quote text,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (rule_version_id, fact_key, url)
);

-- Published rule versions are immutable. A change in the law is a NEW version.
create or replace function public.guard_rule_version_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.publication_status <> 'draft' then
      raise exception 'published rule versions cannot be deleted (rule_version %)', old.id
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.publication_status <> 'draft' then
    -- Only lifecycle columns may change once published.
    if (to_jsonb(new) - 'publication_status' - 'effective_to')
       is distinct from (to_jsonb(old) - 'publication_status' - 'effective_to') then
      raise exception 'published rule versions are immutable; create a new version (rule_version %)', old.id
        using errcode = 'check_violation';
    end if;
    if old.publication_status = 'superseded' and new.publication_status <> 'superseded' then
      raise exception 'superseded rule versions cannot be republished' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger state_rule_versions_immutable
  before update or delete on public.state_rule_versions
  for each row execute function public.guard_rule_version_immutability();

create or replace function public.guard_rule_source_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select publication_status into v_status
  from public.state_rule_versions where id = old.rule_version_id;
  if v_status is distinct from 'draft' then
    raise exception 'sources of published rule versions are immutable' using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger state_rule_sources_immutable
  before update or delete on public.state_rule_sources
  for each row execute function public.guard_rule_source_immutability();

-- ---------------------------------------------------------------------------
-- Pricing (configurable service fees; government fees come from rule versions)
-- ---------------------------------------------------------------------------

create table public.service_prices (
  id uuid primary key default gen_random_uuid(),
  filing_type_code text not null references public.filing_types (code),
  state_code text references public.states (code),
  entity_type text,
  service_fee_cents int not null check (service_fee_cents >= 0 and service_fee_cents <= 1000000),
  -- Live (real-money) checkout refuses prices that the owner has not approved.
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references auth.users (id),
  active boolean not null default true,
  notes text,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_prices_active_scope
  on public.service_prices (filing_type_code, coalesce(state_code, ''), coalesce(entity_type, ''))
  where active;
create trigger service_prices_updated_at before update on public.service_prices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- People: profiles and staff (roles live in the database, never in the client)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 200),
  phone text check (phone is null or char_length(phone) <= 40),
  reminder_emails_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('operator', 'admin')),
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active and s.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 1 and 300),
  state_code text not null references public.states (code),
  entity_type text not null check (entity_type in (
    'llc', 'corporation', 'nonprofit_corporation', 'lp', 'llp',
    'electing_partnership', 'professional_association', 'business_trust', 'other')),
  is_foreign boolean not null default false,
  home_jurisdiction text check (home_jurisdiction is null or char_length(home_jurisdiction) <= 100),
  state_entity_number text check (state_entity_number is null or state_entity_number ~ '^[A-Za-z0-9-]{1,30}$'),
  formation_date date,
  is_nonprofit boolean not null default false,
  -- Standing is only ever "state_registry" when it truly came from a registry integration.
  standing text not null default 'unknown'
    check (standing in ('unknown', 'active', 'inactive', 'not_in_good_standing')),
  standing_source text not null default 'none'
    check (standing_source in ('none', 'customer_reported', 'state_registry')),
  standing_checked_at timestamptz,
  registry_record jsonb,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on public.businesses (owner_user_id);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create table public.business_addresses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('principal_office', 'registered_office', 'mailing')),
  line1 text check (line1 is null or char_length(line1) <= 200),
  line2 text check (line2 is null or char_length(line2) <= 200),
  city text check (city is null or char_length(city) <= 100),
  region text check (region is null or char_length(region) <= 100),
  postal_code text check (postal_code is null or char_length(postal_code) <= 20),
  country text not null default 'US',
  county text check (county is null or char_length(county) <= 100),
  crop_name text check (crop_name is null or char_length(crop_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kind)
);
create trigger business_addresses_updated_at before update on public.business_addresses
  for each row execute function public.set_updated_at();

create table public.business_owners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 200),
  title text not null check (char_length(title) between 1 and 100),
  role_kind text not null check (role_kind in ('governor', 'officer', 'governor_and_officer')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index business_owners_business_idx on public.business_owners (business_id);

-- ---------------------------------------------------------------------------
-- Compliance obligations per business (drives reminders + upcoming events)
-- ---------------------------------------------------------------------------

create table public.filing_requirements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  rule_id uuid not null references public.compliance_rules (id),
  period_year int not null check (period_year between 2000 and 2200),
  due_date date not null,
  status text not null default 'open'
    check (status in ('open', 'filed_with_us', 'filed_elsewhere', 'not_required', 'cancelled')),
  filing_id uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, rule_id, period_year)
);
create index filing_requirements_owner_idx on public.filing_requirements (owner_user_id);
create index filing_requirements_open_due_idx on public.filing_requirements (due_date) where status = 'open';
create trigger filing_requirements_updated_at before update on public.filing_requirements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders and filings
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'payment_failed', 'partially_refunded',
                      'refunded', 'cancelled', 'expired')),
  currency text not null default 'usd' check (currency = 'usd'),
  government_fee_cents int not null check (government_fee_cents >= 0),
  service_fee_cents int not null check (service_fee_cents >= 0),
  total_cents int not null,
  pricing_snapshot jsonb not null,
  payment_mode text not null check (payment_mode in ('sandbox', 'test', 'live')),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_is_sum check (total_cents = government_fee_cents + service_fee_cents)
);
create index orders_user_idx on public.orders (user_id);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.filings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  requirement_id uuid references public.filing_requirements (id),
  order_id uuid references public.orders (id),
  state_code text not null references public.states (code),
  filing_type_code text not null references public.filing_types (code),
  rule_version_id uuid not null references public.state_rule_versions (id),
  rule_snapshot jsonb not null,
  period_year int not null,
  due_date date not null,
  status text not null default 'draft' check (status in (
    'draft', 'needs_information', 'ready_for_review', 'ready_to_file', 'in_progress',
    'submitted', 'accepted', 'rejected', 'needs_customer_action', 'completed',
    'cancelled', 'refunded')),
  assigned_to uuid references auth.users (id),
  state_confirmation_number text check (state_confirmation_number is null or char_length(state_confirmation_number) <= 100),
  submitted_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index filings_user_idx on public.filings (user_id);
create index filings_status_due_idx on public.filings (status, due_date);
create unique index filings_one_active_per_requirement
  on public.filings (requirement_id)
  where requirement_id is not null and status not in ('cancelled', 'refunded');
create trigger filings_updated_at before update on public.filings
  for each row execute function public.set_updated_at();

alter table public.filing_requirements
  add constraint filing_requirements_filing_fk
  foreign key (filing_id) references public.filings (id) on delete set null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  filing_id uuid references public.filings (id),
  kind text not null check (kind in ('government_fee', 'service_fee')),
  description text not null,
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

create table public.filing_answers (
  filing_id uuid primary key references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  answers jsonb not null default '{}',
  completed_steps text[] not null default '{}',
  is_complete boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger filing_answers_updated_at before update on public.filing_answers
  for each row execute function public.set_updated_at();

create table public.filing_authorizations (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  signer_name text not null check (char_length(signer_name) between 2 and 200),
  signer_title text not null check (char_length(signer_title) between 2 and 100),
  attested_accurate boolean not null check (attested_accurate),
  authorized_submission boolean not null check (authorized_submission),
  terms_version text not null,
  authorization_text text not null,
  answers_sha256 text not null check (answers_sha256 ~ '^[0-9a-f]{64}$'),
  answers_snapshot jsonb not null,
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);
create index filing_authorizations_filing_idx on public.filing_authorizations (filing_id);

create table public.filing_status_history (
  id bigint generated always as identity primary key,
  filing_id uuid not null references public.filings (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system')),
  note text,
  customer_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index filing_status_history_filing_idx on public.filing_status_history (filing_id, created_at);

create table public.filing_documents (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  kind text not null check (kind in ('state_receipt', 'filed_report', 'acknowledgement',
                                     'filing_packet', 'customer_upload', 'other')),
  storage_bucket text not null default 'filing-documents',
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  visible_to_customer boolean not null default true,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index filing_documents_filing_idx on public.filing_documents (filing_id);

create table public.filing_receipts (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  document_id uuid references public.filing_documents (id),
  confirmation_number text,
  state_fee_paid_cents int check (state_fee_paid_cents is null or state_fee_paid_cents >= 0),
  submitted_at timestamptz,
  recorded_by uuid references auth.users (id),
  notes text,
  created_at timestamptz not null default now()
);
create index filing_receipts_filing_idx on public.filing_receipts (filing_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  user_id uuid not null references auth.users (id),
  provider text not null check (provider in ('stripe', 'sandbox')),
  mode text not null check (mode in ('sandbox', 'test', 'live')),
  provider_session_id text unique,
  provider_payment_id text,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed', 'expired', 'partially_refunded', 'refunded')),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'usd',
  amount_refunded_cents int not null default 0 check (amount_refunded_cents >= 0),
  failure_reason text,
  receipt_url text,
  requires_review boolean not null default false,
  review_reason text,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  order_id uuid not null references public.orders (id),
  user_id uuid not null references auth.users (id),
  amount_cents int not null check (amount_cents > 0),
  government_fee_cents int not null default 0 check (government_fee_cents >= 0),
  service_fee_cents int not null default 0 check (service_fee_cents >= 0),
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  provider_refund_id text unique,
  requested_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refunds_amount_is_sum check (amount_cents = government_fee_cents + service_fee_cents)
);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  event_created_at timestamptz,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_result text,
  processing_error text,
  attempts int not null default 0,
  unique (provider, provider_event_id)
);

create table public.sandbox_checkout_sessions (
  id text primary key check (id ~ '^sbx_cs_[A-Za-z0-9]+$'),
  order_id uuid not null references public.orders (id),
  payment_id uuid not null references public.payments (id),
  amount_cents int not null,
  currency text not null default 'usd',
  line_items jsonb not null,
  customer_email text,
  success_url text not null,
  cancel_url text not null,
  status text not null default 'open' check (status in ('open', 'completed', 'expired', 'failed')),
  payment_intent_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Reminders and notifications
-- ---------------------------------------------------------------------------

create table public.reminder_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  offsets_days int[] not null,
  filing_type_code text references public.filing_types (code),
  state_code text references public.states (code),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reminder_schedules_updated_at before update on public.reminder_schedules
  for each row execute function public.set_updated_at();

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.filing_requirements (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id) on delete cascade,
  due_date date not null,
  offset_days int not null,
  channel text not null default 'email' check (channel in ('email', 'sms', 'push')),
  scheduled_for date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
  skip_reason text,
  notification_id uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (requirement_id, due_date, offset_days, channel)
);
create index reminders_due_idx on public.reminders (scheduled_for) where status = 'scheduled';
create index reminders_user_idx on public.reminders (user_id);

create table public.notification_templates (
  key text primary key,
  channel text not null default 'email' check (channel in ('email', 'sms', 'push')),
  category text not null check (category in ('reminder', 'transactional')),
  subject text not null,
  body_text text not null,
  cta_label text,
  description text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid references public.businesses (id) on delete set null,
  filing_id uuid references public.filings (id) on delete set null,
  template_key text not null,
  channel text not null default 'email',
  to_address text not null,
  subject text not null,
  body_text text not null,
  body_html text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'suppressed')),
  provider text,
  provider_message_id text,
  error text,
  dedupe_key text unique,
  sent_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.reminders
  add constraint reminders_notification_fk
  foreign key (notification_id) references public.notifications (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Operations: messages, notes, assignments, audit
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  author_id uuid references auth.users (id),
  author_type text not null check (author_type in ('customer', 'staff', 'system')),
  body text not null check (char_length(body) between 1 and 5000),
  read_by_customer_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_filing_idx on public.messages (filing_id, created_at);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index admin_notes_filing_idx on public.admin_notes (filing_id, created_at);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references public.filings (id) on delete cascade,
  assigned_to uuid references auth.users (id),
  assigned_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index assignments_filing_idx on public.assignments (filing_id, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system', 'webhook')),
  action text not null,
  entity_type text not null,
  entity_id text,
  filing_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index audit_logs_filing_idx on public.audit_logs (filing_id, created_at);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.guard_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'check_violation';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.guard_append_only();
create trigger filing_status_history_append_only
  before update or delete on public.filing_status_history
  for each row execute function public.guard_append_only();
create trigger filing_authorizations_append_only
  before update or delete on public.filing_authorizations
  for each row execute function public.guard_append_only();

-- ---------------------------------------------------------------------------
-- Analytics (first-party, no IPs, no user agents), rate limits, waitlist
-- ---------------------------------------------------------------------------

create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'landing_viewed', 'state_page_viewed', 'lookup_started', 'lookup_completed',
    'filing_cta_clicked', 'intake_started', 'intake_completed', 'checkout_started',
    'checkout_cancelled', 'payment_completed', 'reminder_clicked', 'filing_completed')),
  anonymous_id text check (anonymous_id is null or anonymous_id ~ '^[A-Za-z0-9-]{8,64}$'),
  user_id uuid,
  path text check (path is null or char_length(path) <= 300),
  state_code text,
  filing_type_code text,
  entity_type text,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index analytics_events_name_time_idx on public.analytics_events (event_name, created_at);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  state_code text not null references public.states (code),
  created_at timestamptz not null default now(),
  unique (email, state_code)
);
