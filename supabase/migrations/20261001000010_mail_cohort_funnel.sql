-- Frozen mail-pilot cohort and funnel tracking (no mail is created or sent by this).
--
-- Additive: new nullable/defaulted columns on marketing_sends and one service-role-only
-- function. A cohort row is selected = true; considered-but-excluded rows keep their
-- reasons. Funnel: clicked_at (visit) -> record_viewed_at -> converted_business_id (filing
-- started); checkout and payment are read from that business's orders.

alter table public.marketing_sends
  add column if not exists selected boolean not null default false,
  add column if not exists record_viewed_at timestamptz,
  add column if not exists vendor_status text check (vendor_status is null or char_length(vendor_status) <= 60),
  add column if not exists vendor_test boolean,
  add column if not exists mailed_at timestamptz;

create index if not exists marketing_sends_selected_idx on public.marketing_sends (campaign_id) where selected;

-- Record a funnel event for the piece identified by a landing code's campaign prefix and
-- entity number. Idempotent (first time wins). Only the server (service role) may call it.
create or replace function public.mark_mail_event(p_campaign_short text, p_entity_number text, p_event text, p_business_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_campaign_short !~ '^[0-9a-f]{8}$' or p_entity_number !~ '^[0-9]{1,10}$' or p_event not in ('visit', 'record_viewed', 'started') then
    return 0;
  end if;
  update public.marketing_sends s
     set clicked_at = case when p_event in ('visit', 'record_viewed', 'started') then coalesce(s.clicked_at, now()) else s.clicked_at end,
         record_viewed_at = case when p_event in ('record_viewed', 'started') then coalesce(s.record_viewed_at, now()) else s.record_viewed_at end,
         converted_business_id = case when p_event = 'started' then coalesce(s.converted_business_id, p_business_id) else s.converted_business_id end
    from public.prospects p
    join public.state_entity_records r on r.id = p.state_entity_record_id
   where s.prospect_id = p.id
     and s.selected
     and r.entity_number = lpad(p_entity_number, 10, '0')
     and replace(s.campaign_id::text, '-', '') like p_campaign_short || '%';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_mail_event(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.mark_mail_event(text, text, text, uuid) to service_role;
