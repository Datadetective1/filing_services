-- Annual reports in states Filewell doesn't file itself, filed by Registered Agents Inc.
--
-- The customer pays Filewell's service fee plus the state's report fee; staff order the
-- report in the partner dashboard by hand, like a formation. Nothing here sells anything:
-- checkout also needs the state's switch (RAI_REPORT_SALES_<CODE>) and, for real money, an
-- approved price, which this seeds unapproved.

-- 1. A provider order can now be an annual report.
alter table public.provider_orders drop constraint if exists provider_orders_kind_check;
alter table public.provider_orders
  add constraint provider_orders_kind_check
  check (kind in ('registered_agent', 'change_of_agent', 'formation', 'annual_report'));

-- 2. Its own filing type, so its price is separate from the self-filed annual report.
insert into public.filing_types (code, name, description, category, launch_enabled, sort_order)
values ('provider_annual_report', 'Annual report (filed by our provider)', null, 'periodic', false, 17)
on conflict (code) do nothing;

-- 3. $99 plus the state fee, everywhere it is sold. Unapproved: approve it in /admin/pricing.
insert into public.service_prices (filing_type_code, state_code, entity_type, service_fee_cents, approved, active, price_variant, notes)
select 'provider_annual_report', null, null, 9900, false, true, 'standard',
  'Annual report in a state Filewell does not file itself: $99 plus the state report fee. Registered Agents Inc. files it at $75 plus the state fee. Not approved.'
where not exists (
  select 1 from public.service_prices
  where filing_type_code = 'provider_annual_report' and state_code is null and entity_type is null and price_variant = 'standard' and active
);
