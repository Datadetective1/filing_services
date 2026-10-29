-- Business services: registered agent (with Registered Agents Inc. as the wholesale
-- provider), the registered agent + annual report bundle, change of registered agent and
-- business formation. Additive: no existing row, column or behaviour changes meaning.
--
--   * Pricing stays in service_prices. A new price_variant column lets a proposed price
--     (the $79 annual report) exist next to the live one without being charged; existing
--     code reads only the "standard" variant.
--   * Stripe billing and the legal registered agent appointment are separate columns that
--     move independently (ra_subscriptions.billing_status vs service_status).
--   * Provider work items (provider_orders) change status only through
--     transition_provider_order(), which writes history; "active" requires evidence.
--   * Bundle years and annual report reporting years are separate rows; one reporting year
--     per business can be included once, so the same report is never filed twice.
--   * Documents (service of process, notices, mail) live in the existing private bucket,
--     readable only by their owner (and staff); unit economics are staff-only.
--
-- Nothing here enables a sale: every switch is an environment variable (see
-- src/lib/registered-agent/sales.ts) and live checkout refuses unapproved prices.

-- ---------------------------------------------------------------------------
-- Reference data and pricing
-- ---------------------------------------------------------------------------

alter table public.service_prices
  add column if not exists price_variant text not null default 'standard'
    check (price_variant ~ '^[a-z0-9_]{1,40}$');

drop index if exists public.service_prices_active_scope;
create unique index service_prices_active_scope
  on public.service_prices (filing_type_code, coalesce(state_code, ''), coalesce(entity_type, ''), price_variant)
  where active;

-- Anonymous price reads filter on the variant, so anon needs it (it is not sensitive).
grant select (price_variant) on public.service_prices to anon;

-- New filing types (change_registered_agent, ra_annual_report_bundle, additional_mail,
-- reinstatement, ein_assistance) come from FILING_TYPES via the seed, like every other type.

-- ---------------------------------------------------------------------------
-- Businesses being formed, orders for services, subscription payments
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists lifecycle text not null default 'existing'
    check (lifecycle in ('existing', 'forming'));

alter table public.orders
  add column if not exists order_type text not null default 'annual_report'
    check (order_type in ('annual_report', 'business_services', 'subscription_renewal'));

alter table public.order_items
  add column if not exists service_code text check (service_code is null or service_code ~ '^[a-z_]{1,40}$'),
  add column if not exists billing text not null default 'one_time' check (billing in ('one_time', 'annual'));

alter table public.payments
  add column if not exists purpose text not null default 'checkout' check (purpose in ('checkout', 'renewal')),
  add column if not exists provider_subscription_id text,
  add column if not exists provider_invoice_id text unique,
  add column if not exists processing_fee_cents int check (processing_fee_cents is null or processing_fee_cents >= 0);
create index if not exists payments_subscription_idx on public.payments (provider_subscription_id) where provider_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- Registered agent service per business and jurisdiction
-- ---------------------------------------------------------------------------

create table public.ra_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  -- Two-letter code from src/lib/registered-agent/jurisdictions.ts (includes Puerto Rico,
  -- which is not in public.states because Filewell files no annual reports there).
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  plan text not null check (plan in ('registered_agent', 'ra_annual_report_bundle')),
  origin text not null check (origin in ('switching', 'new_entity', 'formation_add_on')),
  order_id uuid references public.orders (id),
  provider text not null default 'registered_agents_inc' check (provider in ('registered_agents_inc', 'other_provider')),
  provider_account_ref text check (provider_account_ref is null or char_length(provider_account_ref) <= 100),
  -- Stripe's view (money). Never decides the legal appointment by itself.
  billing_status text not null default 'pending'
    check (billing_status in ('pending', 'incomplete', 'active', 'past_due', 'unpaid', 'canceled')),
  -- The legal appointment (state record). Moved by operators, with evidence.
  service_status text not null default 'pending_appointment'
    check (service_status in ('pending_appointment', 'active', 'cancellation_requested', 'termination_pending', 'ended')),
  renewal_price_cents int not null check (renewal_price_cents >= 0),
  provider_subscription_id text unique,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancellation_requested_at timestamptz,
  service_end_date date,
  replacement_agent_name text check (replacement_agent_name is null or char_length(replacement_agent_name) <= 200),
  replacement_confirmed_at timestamptz,
  appointment_confirmed_at timestamptz,
  appointment_evidence text check (appointment_evidence is null or char_length(appointment_evidence) <= 2000),
  failed_payment_count int not null default 0 check (failed_payment_count >= 0),
  -- The provider renews each entity yearly on its own date and must be told at least 30
  -- days before that date to cancel an entity whose customer has not paid.
  provider_renewal_date date,
  provider_cancelled_at timestamptz,
  -- Communications contact the provider may request at short notice (a real person, a
  -- physical address and a phone number), collected at checkout so a request never waits.
  contact_name text check (contact_name is null or char_length(contact_name) between 1 and 200),
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9+() .-]{7,30}$'),
  contact_address text check (contact_address is null or char_length(contact_address) between 5 and 500),
  renewal_reminders_sent text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Payment alone never makes an appointment active.
  constraint ra_subscriptions_active_needs_evidence check (
    service_status <> 'active' or (appointment_confirmed_at is not null and coalesce(appointment_evidence, '') <> '')
  )
);
create unique index ra_subscriptions_one_open_per_business_state
  on public.ra_subscriptions (business_id, state_code) where service_status <> 'ended' and billing_status <> 'canceled';
create index ra_subscriptions_user_idx on public.ra_subscriptions (user_id);
create index ra_subscriptions_period_end_idx on public.ra_subscriptions (current_period_end) where billing_status = 'active';
create trigger ra_subscriptions_updated_at before update on public.ra_subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provider work items (manual fulfillment through the partner dashboard)
-- ---------------------------------------------------------------------------

create table public.provider_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  order_id uuid not null references public.orders (id),
  ra_subscription_id uuid references public.ra_subscriptions (id),
  kind text not null check (kind in ('registered_agent', 'change_of_agent', 'formation')),
  -- Two-letter code from src/lib/registered-agent/jurisdictions.ts (includes Puerto Rico,
  -- which is not in public.states because Filewell files no annual reports there).
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  provider text not null default 'registered_agents_inc' check (provider in ('registered_agents_inc', 'other_provider')),
  fulfillment_method text not null default 'registered_agents_inc'
    check (fulfillment_method in ('internal_manual', 'registered_agents_inc', 'other_provider')),
  status text not null default 'new_order' check (status in (
    'new_order', 'payment_confirmed', 'information_needed', 'ready_for_provider', 'submitted_to_provider',
    'processing', 'active', 'completed', 'cancellation_requested', 'provider_termination_pending',
    'terminated', 'refunded', 'cancelled')),
  provider_reference text check (provider_reference is null or char_length(provider_reference) <= 100),
  submitted_at timestamptz,
  confirmed_on date,
  evidence text check (evidence is null or char_length(evidence) <= 2000),
  government_fee_cents int not null default 0 check (government_fee_cents >= 0),
  government_fee_remitted_cents int check (government_fee_remitted_cents is null or government_fee_remitted_cents >= 0),
  wholesale_cost_cents int not null default 0 check (wholesale_cost_cents >= 0),
  -- What the customer told us (validated server-side before it is stored).
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_orders_done_needs_evidence check (
    status not in ('active', 'completed', 'terminated') or (confirmed_on is not null and coalesce(evidence, '') <> '')
  ),
  constraint provider_orders_active_is_appointment check (status <> 'active' or kind = 'registered_agent'),
  constraint provider_orders_completed_is_filing check (status <> 'completed' or kind <> 'registered_agent'),
  constraint provider_orders_submitted_has_reference check (
    status not in ('submitted_to_provider', 'processing', 'active', 'completed') or coalesce(provider_reference, '') <> ''
  )
);
create unique index provider_orders_one_per_order_kind on public.provider_orders (order_id, kind);
create index provider_orders_status_idx on public.provider_orders (status, created_at);
create index provider_orders_user_idx on public.provider_orders (user_id);
create trigger provider_orders_updated_at before update on public.provider_orders
  for each row execute function public.set_updated_at();

create table public.provider_order_events (
  id bigint generated always as identity primary key,
  provider_order_id uuid not null references public.provider_orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system', 'webhook')),
  note text check (note is null or char_length(note) <= 2000),
  customer_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index provider_order_events_order_idx on public.provider_order_events (provider_order_id, created_at);

create or replace function public.provider_order_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_from
    when 'new_order' then p_to in ('payment_confirmed', 'cancelled')
    when 'payment_confirmed' then p_to in ('information_needed', 'ready_for_provider', 'cancellation_requested', 'refunded')
    when 'information_needed' then p_to in ('ready_for_provider', 'cancellation_requested', 'refunded')
    when 'ready_for_provider' then p_to in ('submitted_to_provider', 'information_needed', 'cancellation_requested', 'refunded')
    when 'submitted_to_provider' then p_to in ('processing', 'active', 'completed', 'information_needed', 'cancellation_requested')
    when 'processing' then p_to in ('active', 'completed', 'information_needed', 'cancellation_requested')
    when 'active' then p_to in ('cancellation_requested')
    when 'completed' then p_to in ('refunded')
    when 'cancellation_requested' then p_to in ('provider_termination_pending', 'active', 'refunded')
    when 'provider_termination_pending' then p_to in ('terminated')
    when 'terminated' then p_to in ('refunded')
    else false
  end;
$$;

-- Status may change only through transition_provider_order().
create or replace function public.guard_provider_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and coalesce(current_setting('app.provider_order_transition', true), '') <> 'on' then
    raise exception 'provider order status changes must go through transition_provider_order()' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger provider_orders_status_guard before update on public.provider_orders
  for each row execute function public.guard_provider_order_status();

create or replace function public.transition_provider_order(
  p_id uuid,
  p_to_status text,
  p_actor_user_id uuid,
  p_actor_type text,
  p_note text default null,
  p_customer_visible boolean default true,
  p_patch jsonb default '{}'::jsonb,
  p_expected_from text default null
)
returns public.provider_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.provider_orders;
  v_from text;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_bad_key text;
begin
  if p_actor_type not in ('customer', 'staff', 'system', 'webhook') then
    raise exception 'invalid actor type %', p_actor_type using errcode = 'check_violation';
  end if;
  select * into v_row from public.provider_orders where id = p_id for update;
  if not found then
    raise exception 'provider order % not found', p_id using errcode = 'no_data_found';
  end if;
  v_from := v_row.status;
  if p_expected_from is not null and v_from <> p_expected_from then
    raise exception 'provider order % is %, expected %', p_id, v_from, p_expected_from using errcode = 'serialization_failure';
  end if;
  if not public.provider_order_transition_allowed(v_from, p_to_status) then
    raise exception 'transition % -> % is not allowed', v_from, p_to_status using errcode = 'check_violation';
  end if;
  select k into v_bad_key from jsonb_object_keys(v_patch) as k
   where k not in ('provider_reference', 'submitted_at', 'confirmed_on', 'evidence', 'government_fee_remitted_cents')
   limit 1;
  if v_bad_key is not null then
    raise exception 'patch key % is not allowed', v_bad_key using errcode = 'check_violation';
  end if;

  perform set_config('app.provider_order_transition', 'on', true);
  update public.provider_orders set
    status = p_to_status,
    provider_reference = coalesce(nullif(v_patch ->> 'provider_reference', ''), provider_reference),
    submitted_at = case when p_to_status = 'submitted_to_provider'
                        then coalesce((v_patch ->> 'submitted_at')::timestamptz, now()) else submitted_at end,
    confirmed_on = coalesce((v_patch ->> 'confirmed_on')::date, confirmed_on),
    evidence = coalesce(nullif(v_patch ->> 'evidence', ''), evidence),
    government_fee_remitted_cents = coalesce((v_patch ->> 'government_fee_remitted_cents')::int, government_fee_remitted_cents)
  where id = p_id
  returning * into v_row;
  perform set_config('app.provider_order_transition', 'off', true);

  insert into public.provider_order_events (provider_order_id, from_status, to_status, actor_user_id, actor_type, note, customer_visible)
  values (p_id, v_from, p_to_status, p_actor_user_id, p_actor_type, p_note, p_customer_visible);
  insert into public.audit_logs (actor_user_id, actor_type, action, entity_type, entity_id, before, after)
  values (p_actor_user_id, p_actor_type,
          'provider_order.transition', 'provider_order', p_id::text,
          jsonb_build_object('status', v_from), jsonb_build_object('status', p_to_status, 'patch', v_patch));
  return v_row;
end;
$$;

revoke all on function public.transition_provider_order(uuid, text, uuid, text, text, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.transition_provider_order(uuid, text, uuid, text, text, boolean, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Bundle years: which reporting year each billing year includes
-- ---------------------------------------------------------------------------

create table public.bundle_filing_periods (
  id uuid primary key default gen_random_uuid(),
  ra_subscription_id uuid not null references public.ra_subscriptions (id),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  period_start date not null,
  period_end date not null,
  reporting_year int check (reporting_year is null or reporting_year between 2000 and 2200),
  requirement_id uuid references public.filing_requirements (id),
  filing_id uuid references public.filings (id),
  status text not null default 'scheduled' check (status in (
    'scheduled', 'awaiting_authorization', 'authorized', 'filing_in_progress', 'filed', 'not_included', 'superseded')),
  state_fee_cents int check (state_fee_cents is null or state_fee_cents >= 0),
  state_fee_collection text not null default 'not_due'
    check (state_fee_collection in ('not_due', 'awaiting_authorization', 'checkout_open', 'collected', 'not_applicable')),
  authorization_requested_at timestamptz,
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bundle_period_order check (period_start < period_end),
  constraint bundle_included_has_year check (status in ('not_included', 'superseded') or reporting_year is not null)
);
create unique index bundle_filing_periods_one_per_period on public.bundle_filing_periods (ra_subscription_id, period_start);
-- A reporting year is included in at most one live bundle period per business.
create unique index bundle_filing_periods_one_per_year
  on public.bundle_filing_periods (business_id, reporting_year) where status not in ('not_included', 'superseded');
create unique index bundle_filing_periods_one_per_requirement
  on public.bundle_filing_periods (requirement_id) where requirement_id is not null and status not in ('not_included', 'superseded');
create unique index bundle_filing_periods_one_per_filing
  on public.bundle_filing_periods (filing_id) where filing_id is not null;
create trigger bundle_filing_periods_updated_at before update on public.bundle_filing_periods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Registered agent documents and urgent notifications
-- ---------------------------------------------------------------------------

create table public.service_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  business_id uuid not null references public.businesses (id),
  ra_subscription_id uuid references public.ra_subscriptions (id),
  kind text not null check (kind in ('service_of_process', 'government_notice', 'regular_mail', 'filing_confirmation', 'business_record')),
  urgency text not null check (urgency in ('urgent', 'high', 'normal')),
  summary text check (summary is null or char_length(summary) <= 1000),
  storage_bucket text not null default 'filing-documents',
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Timing, recorded as it happens; nothing here is a promise to the customer.
  provider_received_at timestamptz,
  available_to_filewell_at timestamptz not null default now(),
  operator_processed_at timestamptz,
  customer_notified_at timestamptz,
  escalation_status text not null default 'none'
    check (escalation_status in ('none', 'pending', 'backup_operator', 'owner', 'resolved')),
  billable_mail boolean not null default false,
  visible_to_customer boolean not null default true,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint service_documents_billable_is_regular_mail check (not billable_mail or kind = 'regular_mail')
);
create index service_documents_user_idx on public.service_documents (user_id, created_at desc);
create index service_documents_unnotified_idx on public.service_documents (available_to_filewell_at)
  where customer_notified_at is null and urgency <> 'normal';

create table public.document_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.service_documents (id) on delete cascade,
  channel text not null check (channel in ('email', 'phone', 'sms')),
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'acknowledged')),
  notification_id uuid references public.notifications (id) on delete set null,
  attempted_by uuid references auth.users (id),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index document_notification_attempts_doc_idx on public.document_notification_attempts (document_id, created_at);

-- ---------------------------------------------------------------------------
-- Unit economics (staff only)
-- ---------------------------------------------------------------------------

create table public.order_economics (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  service_code text not null check (service_code ~ '^[a-z_]{1,40}$'),
  fulfillment_method text not null check (fulfillment_method in ('internal_manual', 'registered_agents_inc', 'other_provider')),
  service_revenue_cents int not null default 0 check (service_revenue_cents >= 0),
  government_fees_collected_cents int not null default 0 check (government_fees_collected_cents >= 0),
  government_fees_remitted_cents int not null default 0 check (government_fees_remitted_cents >= 0),
  wholesale_cost_cents int not null default 0 check (wholesale_cost_cents >= 0),
  acquisition_cost_cents int not null default 0 check (acquisition_cost_cents >= 0),
  processing_fee_cents int not null default 0 check (processing_fee_cents >= 0),
  processing_fee_source text not null default 'estimated' check (processing_fee_source in ('actual', 'estimated')),
  service_refunds_cents int not null default 0 check (service_refunds_cents >= 0),
  government_refunds_cents int not null default 0 check (government_refunds_cents >= 0),
  tax_collected_cents int not null default 0 check (tax_collected_cents >= 0),
  price_variant text not null default 'standard',
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, service_code)
);
create trigger order_economics_updated_at before update on public.order_economics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Analytics: service funnel events (superset of the previous list)
-- ---------------------------------------------------------------------------

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'landing_viewed', 'state_page_viewed', 'lookup_started', 'lookup_completed',
  'filing_cta_clicked', 'intake_started', 'intake_completed', 'checkout_started',
  'checkout_cancelled', 'payment_completed', 'reminder_clicked', 'filing_completed',
  'registry_search', 'registry_selected', 'prefill_applied', 'prefill_confirmed', 'outreach_clicked',
  'visit_started', 'reminder_opt_in', 'reminder_confirmed', 'reminder_unsubscribed', 'reminder_sent',
  'service_page_viewed', 'checkout_abandoned', 'subscription_renewed', 'subscription_cancelled', 'refund_issued'));

-- ---------------------------------------------------------------------------
-- Row-level security: customers read their own rows; only the server writes
-- ---------------------------------------------------------------------------

alter table public.ra_subscriptions enable row level security;
alter table public.provider_orders enable row level security;
alter table public.provider_order_events enable row level security;
alter table public.bundle_filing_periods enable row level security;
alter table public.service_documents enable row level security;
alter table public.document_notification_attempts enable row level security;
alter table public.order_economics enable row level security;

create policy ra_subscriptions_select on public.ra_subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy provider_orders_select on public.provider_orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy provider_order_events_select on public.provider_order_events for select to authenticated
  using (
    (customer_visible and exists (select 1 from public.provider_orders o
                                  where o.id = provider_order_id and o.user_id = (select auth.uid())))
    or (select public.is_staff())
  );
create policy bundle_filing_periods_select on public.bundle_filing_periods for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy service_documents_select on public.service_documents for select to authenticated
  using ((user_id = (select auth.uid()) and visible_to_customer) or (select public.is_staff()));
create policy document_notification_attempts_select on public.document_notification_attempts for select to authenticated
  using ((select public.is_staff()));
create policy order_economics_select on public.order_economics for select to authenticated
  using ((select public.is_staff()));

-- No insert/update/delete policies: money, status and legal records are written by the
-- server with the service role after it authorizes the actor. Anonymous visitors get nothing.
revoke all on public.ra_subscriptions, public.provider_orders, public.provider_order_events, public.bundle_filing_periods,
  public.service_documents, public.document_notification_attempts, public.order_economics from anon;
revoke insert, update, delete on public.ra_subscriptions, public.provider_orders, public.provider_order_events,
  public.bundle_filing_periods, public.service_documents, public.document_notification_attempts, public.order_economics from authenticated;

-- History and attempts are append-only.
create trigger provider_order_events_append_only before update or delete on public.provider_order_events
  for each row execute function public.guard_append_only();
create trigger document_notification_attempts_append_only before update or delete on public.document_notification_attempts
  for each row execute function public.guard_append_only();
