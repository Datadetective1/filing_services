-- Controlled mutations. Every function here is SECURITY DEFINER and executable only
-- by service_role: the application calls them from trusted server code AFTER it has
-- authorized the actor. They keep multi-row changes atomic and always write the
-- audit trail in the same transaction as the change itself.

-- ---------------------------------------------------------------------------
-- Filing status machine
-- ---------------------------------------------------------------------------

-- Keep in sync with src/lib/domain/filing-status.ts (a DB test asserts they match).
create or replace function public.filing_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('draft', 'needs_information'),
    ('draft', 'ready_for_review'),
    ('draft', 'cancelled'),
    ('needs_information', 'ready_for_review'),
    ('needs_information', 'cancelled'),
    ('ready_for_review', 'ready_to_file'),
    ('ready_for_review', 'needs_customer_action'),
    ('ready_for_review', 'cancelled'),
    ('ready_to_file', 'in_progress'),
    ('ready_to_file', 'submitted'),
    ('ready_to_file', 'needs_customer_action'),
    ('ready_to_file', 'cancelled'),
    ('in_progress', 'submitted'),
    ('in_progress', 'ready_to_file'),
    ('in_progress', 'needs_customer_action'),
    ('in_progress', 'cancelled'),
    ('submitted', 'accepted'),
    ('submitted', 'rejected'),
    ('accepted', 'completed'),
    ('rejected', 'needs_customer_action'),
    ('rejected', 'ready_to_file'),
    ('rejected', 'cancelled'),
    ('needs_customer_action', 'ready_for_review'),
    ('needs_customer_action', 'cancelled'),
    ('cancelled', 'refunded'),
    ('cancelled', 'ready_for_review'),
    ('completed', 'ready_for_review')
  );
$$;

-- Direct status edits are rejected; only transition_filing() may change status.
create or replace function public.guard_filing_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'filings must be created in draft status' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status
     and coalesce(current_setting('app.filing_transition', true), 'off') <> 'on' then
    raise exception 'filing status changes must go through transition_filing()'
      using errcode = 'check_violation';
  end if;
  if (new.rule_version_id is distinct from old.rule_version_id
      or new.rule_snapshot is distinct from old.rule_snapshot) and old.order_id is not null then
    raise exception 'the compliance rule of an ordered filing is frozen' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger filings_guard_status
  before insert or update on public.filings
  for each row execute function public.guard_filing_status_change();

create or replace function public.transition_filing(
  p_filing_id uuid,
  p_to_status text,
  p_actor_user_id uuid,
  p_actor_type text,
  p_note text default null,
  p_customer_visible boolean default true,
  p_patch jsonb default '{}'::jsonb,
  p_expected_from text default null
)
returns public.filings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filing public.filings;
  v_from text;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_bad_key text;
begin
  if p_actor_type not in ('customer', 'staff', 'system') then
    raise exception 'invalid actor type %', p_actor_type using errcode = 'check_violation';
  end if;

  select * into v_filing from public.filings where id = p_filing_id for update;
  if not found then
    raise exception 'filing % not found', p_filing_id using errcode = 'no_data_found';
  end if;
  v_from := v_filing.status;

  if p_expected_from is not null and v_from <> p_expected_from then
    raise exception 'filing % is %, expected %', p_filing_id, v_from, p_expected_from
      using errcode = 'serialization_failure';
  end if;

  if not public.filing_transition_allowed(v_from, p_to_status) then
    raise exception 'transition % -> % is not allowed', v_from, p_to_status
      using errcode = 'check_violation';
  end if;

  select k into v_bad_key from jsonb_object_keys(v_patch) as k
  where k not in ('state_confirmation_number', 'submitted_at', 'accepted_at', 'rejection_reason')
  limit 1;
  if v_bad_key is not null then
    raise exception 'patch key % is not allowed', v_bad_key using errcode = 'check_violation';
  end if;

  if p_to_status = 'rejected' and coalesce(v_patch ->> 'rejection_reason', '') = '' then
    raise exception 'a rejection reason is required' using errcode = 'check_violation';
  end if;

  perform set_config('app.filing_transition', 'on', true);
  update public.filings set
    status = p_to_status,
    state_confirmation_number = coalesce(nullif(v_patch ->> 'state_confirmation_number', ''), state_confirmation_number),
    submitted_at = case when p_to_status = 'submitted'
                        then coalesce((v_patch ->> 'submitted_at')::timestamptz, now())
                        else submitted_at end,
    accepted_at = case when p_to_status = 'accepted'
                       then coalesce((v_patch ->> 'accepted_at')::timestamptz, now())
                       else accepted_at end,
    completed_at = case when p_to_status = 'completed' then now()
                        when p_to_status = 'ready_for_review' then null
                        else completed_at end,
    cancelled_at = case when p_to_status = 'cancelled' then now() else cancelled_at end,
    rejection_reason = case when p_to_status = 'rejected' then v_patch ->> 'rejection_reason'
                            else rejection_reason end
  where id = p_filing_id
  returning * into v_filing;
  perform set_config('app.filing_transition', 'off', true);

  insert into public.filing_status_history
    (filing_id, from_status, to_status, actor_user_id, actor_type, note, customer_visible)
  values
    (p_filing_id, v_from, p_to_status, p_actor_user_id, p_actor_type, p_note, p_customer_visible);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, filing_id, before, after, metadata)
  values
    (p_actor_user_id, p_actor_type, 'filing.status_changed', 'filing', p_filing_id::text, p_filing_id,
     jsonb_build_object('status', v_from),
     jsonb_build_object('status', p_to_status),
     jsonb_build_object('note', p_note, 'patch', v_patch));

  -- Once the filing is with the state, deadline reminders for this period stop.
  if p_to_status in ('submitted', 'accepted', 'completed') and v_filing.requirement_id is not null then
    update public.reminders
       set status = 'cancelled', skip_reason = 'filing_' || p_to_status, processed_at = now()
     where requirement_id = v_filing.requirement_id and status = 'scheduled';
  end if;

  if p_to_status in ('accepted', 'completed') and v_filing.requirement_id is not null then
    update public.filing_requirements
       set status = 'filed_with_us', filing_id = v_filing.id, resolved_at = coalesce(resolved_at, now())
     where id = v_filing.requirement_id and status <> 'filed_with_us';
  end if;

  -- A reopened filing puts its period back in play.
  if p_to_status = 'ready_for_review' and v_from in ('completed', 'cancelled')
     and v_filing.requirement_id is not null then
    update public.filing_requirements
       set status = 'open', resolved_at = null, filing_id = v_filing.id
     where id = v_filing.requirement_id;
  end if;

  return v_filing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Assignment
-- ---------------------------------------------------------------------------

create or replace function public.assign_filing(
  p_filing_id uuid,
  p_assignee uuid,
  p_actor_user_id uuid
)
returns public.filings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before uuid;
  v_filing public.filings;
begin
  if p_assignee is not null and not exists (
    select 1 from public.staff_members where user_id = p_assignee and active
  ) then
    raise exception 'assignee is not an active staff member' using errcode = 'check_violation';
  end if;

  select assigned_to into v_before from public.filings where id = p_filing_id for update;
  if not found then
    raise exception 'filing % not found', p_filing_id using errcode = 'no_data_found';
  end if;

  update public.filings set assigned_to = p_assignee where id = p_filing_id returning * into v_filing;

  insert into public.assignments (filing_id, assigned_to, assigned_by)
  values (p_filing_id, p_assignee, p_actor_user_id);

  insert into public.audit_logs
    (actor_user_id, actor_type, action, entity_type, entity_id, filing_id, before, after)
  values
    (p_actor_user_id, 'staff', 'filing.assigned', 'filing', p_filing_id::text, p_filing_id,
     jsonb_build_object('assigned_to', v_before), jsonb_build_object('assigned_to', p_assignee));

  return v_filing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments. Each function is idempotent and never moves a payment "backwards",
-- so duplicate or out-of-order webhook deliveries are harmless.
-- ---------------------------------------------------------------------------

create or replace function public.apply_payment_success(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_receipt_url text,
  p_amount_cents int,
  p_currency text,
  p_event_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_order public.orders;
  v_filing public.filings;
  v_answers_complete boolean;
  v_has_auth boolean;
  v_target text;
  v_newly_paid boolean := false;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  -- Server-side amount verification: never trust a success event for a different amount.
  if p_amount_cents is distinct from v_order.total_cents
     or lower(coalesce(p_currency, '')) <> v_order.currency then
    update public.payments
       set requires_review = true,
           review_reason = format('amount mismatch: event %s %s, order %s %s',
                                  p_amount_cents, p_currency, v_order.total_cents, v_order.currency),
           last_event_at = greatest(coalesce(last_event_at, p_event_at), p_event_at)
     where id = p_payment_id;
    insert into public.audit_logs (actor_type, action, entity_type, entity_id, metadata)
    values ('webhook', 'payment.amount_mismatch', 'payment', p_payment_id::text,
            jsonb_build_object('event_amount', p_amount_cents, 'order_total', v_order.total_cents));
    return jsonb_build_object('applied', false, 'reason', 'amount_mismatch');
  end if;

  -- A second, different payment succeeding for an already-paid order (e.g. two
  -- checkout tabs) is recorded but flagged so an operator refunds the duplicate.
  if v_payment.status in ('pending', 'failed', 'expired') and v_order.status not in
     ('pending_payment', 'payment_failed', 'expired') then
    update public.payments
       set status = 'succeeded',
           provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
           requires_review = true,
           review_reason = 'duplicate payment for an order that was already paid - refund it',
           last_event_at = greatest(coalesce(last_event_at, p_event_at), p_event_at)
     where id = p_payment_id;
    insert into public.audit_logs (actor_type, action, entity_type, entity_id, metadata)
    values ('webhook', 'payment.duplicate', 'payment', p_payment_id::text,
            jsonb_build_object('order_id', v_order.id, 'order_status', v_order.status));
    return jsonb_build_object('applied', false, 'reason', 'duplicate_payment', 'order_id', v_order.id);
  end if;

  if v_payment.status in ('pending', 'failed', 'expired') then
    update public.payments
       set status = 'succeeded',
           provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
           receipt_url = coalesce(p_receipt_url, receipt_url),
           failure_reason = null,
           last_event_at = greatest(coalesce(last_event_at, p_event_at), p_event_at)
     where id = p_payment_id;
    v_newly_paid := true;
  end if;

  if v_order.status in ('pending_payment', 'payment_failed', 'expired') then
    update public.orders set status = 'paid', paid_at = coalesce(paid_at, now()) where id = v_order.id;
    insert into public.audit_logs (actor_type, action, entity_type, entity_id, after)
    values ('webhook', 'order.paid', 'order', v_order.id::text,
            jsonb_build_object('total_cents', v_order.total_cents,
                               'government_fee_cents', v_order.government_fee_cents,
                               'service_fee_cents', v_order.service_fee_cents));
  end if;

  select * into v_filing from public.filings where order_id = v_order.id for update;
  if found and v_filing.status = 'draft' then
    select coalesce(is_complete, false) into v_answers_complete
      from public.filing_answers where filing_id = v_filing.id;
    select exists (select 1 from public.filing_authorizations where filing_id = v_filing.id)
      into v_has_auth;
    v_target := case when coalesce(v_answers_complete, false) and v_has_auth
                     then 'ready_for_review' else 'needs_information' end;
    perform public.transition_filing(v_filing.id, v_target, null, 'system',
                                     'Payment received', true, '{}'::jsonb, 'draft');
    if v_filing.requirement_id is not null then
      update public.filing_requirements set filing_id = v_filing.id where id = v_filing.requirement_id;
    end if;
  end if;

  return jsonb_build_object(
    'applied', true,
    'newly_paid', v_newly_paid,
    'order_id', v_order.id,
    'filing_id', v_filing.id,
    'user_id', v_order.user_id
  );
end;
$$;

create or replace function public.apply_payment_failure(
  p_payment_id uuid,
  p_status text,           -- 'failed' | 'expired'
  p_reason text,
  p_event_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if p_status not in ('failed', 'expired') then
    raise exception 'invalid failure status %', p_status using errcode = 'check_violation';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment % not found', p_payment_id using errcode = 'no_data_found';
  end if;
  -- Never downgrade a successful payment (out-of-order delivery).
  if v_payment.status <> 'pending' and not (v_payment.status = 'failed' and p_status = 'expired') then
    return jsonb_build_object('applied', false, 'reason', 'ignored_out_of_order', 'current', v_payment.status);
  end if;
  update public.payments
     set status = p_status, failure_reason = left(p_reason, 500),
         last_event_at = greatest(coalesce(last_event_at, p_event_at), p_event_at)
   where id = p_payment_id;
  update public.orders
     set status = case when p_status = 'failed' then 'payment_failed' else 'expired' end
   where id = v_payment.order_id and status in ('pending_payment', 'payment_failed');
  insert into public.audit_logs (actor_type, action, entity_type, entity_id, metadata)
  values ('webhook', 'payment.' || p_status, 'payment', p_payment_id::text,
          jsonb_build_object('reason', left(p_reason, 500)));
  return jsonb_build_object('applied', true, 'order_id', v_payment.order_id, 'user_id', v_payment.user_id);
end;
$$;

create or replace function public.apply_refund_result(
  p_refund_id uuid,
  p_status text,           -- 'succeeded' | 'failed'
  p_provider_refund_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
  v_payment public.payments;
  v_total_refunded int;
  v_net_captured bigint;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid refund status %', p_status using errcode = 'check_violation';
  end if;
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'refund % not found', p_refund_id using errcode = 'no_data_found';
  end if;
  if v_refund.status <> 'pending' then
    return jsonb_build_object('applied', false, 'reason', 'already_' || v_refund.status);
  end if;

  update public.refunds
     set status = p_status, provider_refund_id = coalesce(p_provider_refund_id, provider_refund_id)
   where id = p_refund_id;

  if p_status = 'succeeded' then
    perform 1 from public.orders where id = v_refund.order_id for update;
    select * into v_payment from public.payments where id = v_refund.payment_id for update;
    v_total_refunded := v_payment.amount_refunded_cents + v_refund.amount_cents;
    update public.payments
       set amount_refunded_cents = v_total_refunded,
           status = case when v_total_refunded >= amount_cents then 'refunded' else 'partially_refunded' end
     where id = v_payment.id;
    -- The order's status follows what it still holds across ALL captured payments:
    -- an order can have a flagged duplicate payment, and refunding one of the two
    -- must not mark an order that is still fully paid as refunded.
    select coalesce(sum(amount_cents - amount_refunded_cents), 0) into v_net_captured
      from public.payments
     where order_id = v_refund.order_id and status in ('succeeded', 'partially_refunded', 'refunded');
    update public.orders
       set status = case when v_net_captured <= 0 then 'refunded'
                         when v_net_captured < total_cents then 'partially_refunded'
                         else status end
     where id = v_refund.order_id;
  end if;

  insert into public.audit_logs (actor_type, action, entity_type, entity_id, after)
  values ('webhook', 'refund.' || p_status, 'refund', p_refund_id::text,
          jsonb_build_object('amount_cents', v_refund.amount_cents,
                             'government_fee_cents', v_refund.government_fee_cents,
                             'service_fee_cents', v_refund.service_fee_cents));
  return jsonb_build_object('applied', true, 'order_id', v_refund.order_id, 'user_id', v_refund.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window)
-- ---------------------------------------------------------------------------

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
  values (left(p_key, 200), v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down execution
-- ---------------------------------------------------------------------------

revoke all on function public.transition_filing(uuid, text, uuid, text, text, boolean, jsonb, text) from public, anon, authenticated;
revoke all on function public.assign_filing(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.apply_payment_success(uuid, text, text, int, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_payment_failure(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_refund_result(uuid, text, text) from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.transition_filing(uuid, text, uuid, text, text, boolean, jsonb, text) to service_role;
grant execute on function public.assign_filing(uuid, uuid, uuid) to service_role;
grant execute on function public.apply_payment_success(uuid, text, text, int, text, timestamptz) to service_role;
grant execute on function public.apply_payment_failure(uuid, text, text, timestamptz) to service_role;
grant execute on function public.apply_refund_result(uuid, text, text) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

grant execute on function public.is_staff() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
