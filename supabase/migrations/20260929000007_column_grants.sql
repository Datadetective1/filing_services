-- Stop the publishable key (and signed-in customers) from reading internal columns of
-- public reference tables.
--
-- Row-level security decides WHICH rows a role sees, never WHICH columns. The anon key
-- ships in the site's JavaScript, so before this migration anyone could read
-- service_prices.notes, approved_by and updated_by (staff auth user ids), and
-- state_rule_versions.notes and verified_by (internal research notes).
--
-- Backward compatible with the app as it is:
--   * Public prices are read as anon with an explicit column list
--     (src/lib/filings/rules-db.ts listActivePrices). Checkout reads prices with the
--     service role. Neither needs the internal columns.
--   * Staff pages read with the signed-in (authenticated) client and DO need them:
--     /admin/pricing selects notes, approved_at, approved_by, updated_by, updated_at;
--     /admin/rules/[code] selects state_rule_versions.*. Staff and customers share the
--     authenticated role, so a column grant cannot tell them apart. authenticated keeps
--     its table-level SELECT, and customers are kept out of service_prices by row policy
--     instead (no customer code path reads service_prices with the user's session).
--   * The app never reads state_rule_versions as anon.
--
-- Rollout: deploy the app code first, then apply this migration. After it, `select=*`
-- as anon on either table fails with "permission denied".
-- A column added to either table later is NOT readable by anon until it is granted here
-- or in a later migration.

-- ---------------------------------------------------------------------------
-- service_prices
-- ---------------------------------------------------------------------------

revoke select on public.service_prices from anon;
grant select (id, filing_type_code, state_code, entity_type, service_fee_cents, approved, active)
  on public.service_prices to anon;

-- Previously: to anon, authenticated using (active or is_staff()). Anonymous visitors
-- still see active prices (public columns only). Signed-in users see rows only when they
-- are staff, which is what /admin and /admin/pricing need.
drop policy if exists service_prices_read on public.service_prices;
create policy service_prices_read on public.service_prices for select to anon
  using (active);
create policy service_prices_read_staff on public.service_prices for select to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- state_rule_versions (anon only: authenticated staff pages select *, and each filing's
-- rule_snapshot already carries the version row for its owner)
-- ---------------------------------------------------------------------------

revoke select on public.state_rule_versions from anon;
grant select (
  id, rule_id, version, verification_status, publication_status, effective_from, effective_to,
  filing_name, form_number, due_rule, first_due_rule, state_fee_cents, nonprofit_state_fee_cents,
  late_fee_cents, late_fee_summary, consequence_summary, who_must_file, required_information,
  intake_schema, official_filing_url, official_info_url, filing_method_summary, processing_summary,
  customer_summary, faq, content_hash, last_verified_at, created_at
) on public.state_rule_versions to anon;
