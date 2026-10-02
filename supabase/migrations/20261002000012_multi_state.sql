-- Multi-state engine (Washington, Nevada, Utah alongside Pennsylvania).
--
-- Additive and backward compatible:
--   state_rule_versions   fee_components / late_fees / filing_window_days_before: itemized
--                         government fees (e.g. Nevada's Annual List + State Business
--                         License) and verified late-fee triggers, frozen with each version
--                         and copied into every filing's rule_snapshot.
--   state_entity_records  due_date + status_checked_at: the state's own expiration/due date
--                         and when its status was read (e.g. a Washington CCFS export), so a
--                         status-based fee is applied only from a dated official record.
--   order_items           kind 'government_late_fee' so a state's late/delinquency charge is
--                         never shown or counted as Filewell revenue.

alter table public.state_rule_versions
  add column if not exists fee_components jsonb,
  add column if not exists late_fees jsonb,
  add column if not exists filing_window_days_before int check (filing_window_days_before is null or filing_window_days_before between 0 and 366);

-- Public facts, readable like the other published columns (see 20260929000007).
grant select (fee_components, late_fees, filing_window_days_before) on public.state_rule_versions to anon;

alter table public.state_entity_records
  add column if not exists due_date date,
  add column if not exists status_checked_at timestamptz;
create index if not exists state_entity_records_due_idx on public.state_entity_records (state_code, due_date);

alter table public.order_items drop constraint if exists order_items_kind_check;
alter table public.order_items add constraint order_items_kind_check check (kind in ('government_fee', 'government_late_fee', 'service_fee'));
