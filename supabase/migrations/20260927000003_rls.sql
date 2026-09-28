-- Row-level security. Tenant isolation is enforced by the database, not only by
-- application code. Default posture: RLS on everywhere, deny unless a policy allows.
--
-- Writes that carry money, status or compliance meaning (orders, payments, filings,
-- requirements, documents, receipts, reminders, notifications, audit) are NEVER
-- writable by end users directly; the server performs them with the service role
-- after authorizing the actor. End users may write only their own profile fields,
-- business records, intake answers, authorizations and messages.

alter table public.states enable row level security;
alter table public.state_agencies enable row level security;
alter table public.filing_types enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.state_rule_versions enable row level security;
alter table public.state_rule_sources enable row level security;
alter table public.service_prices enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_members enable row level security;
alter table public.businesses enable row level security;
alter table public.business_addresses enable row level security;
alter table public.business_owners enable row level security;
alter table public.filing_requirements enable row level security;
alter table public.orders enable row level security;
alter table public.filings enable row level security;
alter table public.order_items enable row level security;
alter table public.filing_answers enable row level security;
alter table public.filing_authorizations enable row level security;
alter table public.filing_status_history enable row level security;
alter table public.filing_documents enable row level security;
alter table public.filing_receipts enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.payment_events enable row level security;
alter table public.sandbox_checkout_sessions enable row level security;
alter table public.reminder_schedules enable row level security;
alter table public.reminders enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.admin_notes enable row level security;
alter table public.assignments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.rate_limits enable row level security;
alter table public.waitlist enable row level security;

-- ---------------------------------------------------------------------------
-- Public reference data (read-only for everyone)
-- ---------------------------------------------------------------------------

create policy states_read on public.states for select to anon, authenticated using (true);
create policy state_agencies_read on public.state_agencies for select to anon, authenticated using (true);
create policy filing_types_read on public.filing_types for select to anon, authenticated using (true);
create policy compliance_rules_read on public.compliance_rules for select to anon, authenticated using (true);
create policy state_rule_versions_read on public.state_rule_versions for select to anon, authenticated
  using (publication_status <> 'draft' or (select public.is_staff()));
create policy state_rule_sources_read on public.state_rule_sources for select to anon, authenticated using (true);
create policy service_prices_read on public.service_prices for select to anon, authenticated
  using (active or (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Profiles and staff
-- ---------------------------------------------------------------------------

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Column-level: users may only change these fields on their own profile.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, reminder_emails_enabled) on public.profiles to authenticated;

create policy staff_members_select on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Businesses (owned by a single user)
-- ---------------------------------------------------------------------------

create policy businesses_select on public.businesses for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_staff()));
create policy businesses_insert_own on public.businesses for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and standing_source <> 'state_registry'
    and registry_record is null
  );
create policy businesses_update_own on public.businesses for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
revoke update on public.businesses from anon, authenticated;
grant update (legal_name, state_entity_number, formation_date, is_foreign, home_jurisdiction,
              is_nonprofit, archived_at)
  on public.businesses to authenticated;

create policy business_addresses_select on public.business_addresses for select to authenticated
  using (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_user_id = (select auth.uid()))
    or (select public.is_staff())
  );
create policy business_addresses_write_own on public.business_addresses for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b
                      where b.id = business_id and b.owner_user_id = (select auth.uid())));

create policy business_owners_select on public.business_owners for select to authenticated
  using (
    exists (select 1 from public.businesses b
            where b.id = business_id and b.owner_user_id = (select auth.uid()))
    or (select public.is_staff())
  );
create policy business_owners_write_own on public.business_owners for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.owner_user_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b
                      where b.id = business_id and b.owner_user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Read-only-for-owner tables (server writes with service role)
-- ---------------------------------------------------------------------------

create policy filing_requirements_select on public.filing_requirements for select to authenticated
  using (owner_user_id = (select auth.uid()) or (select public.is_staff()));

create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy filings_select on public.filings for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy order_items_select on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or (select public.is_staff())
  );

create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy refunds_select on public.refunds for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy filing_status_history_select on public.filing_status_history for select to authenticated
  using (
    (customer_visible and exists (select 1 from public.filings f
                                  where f.id = filing_id and f.user_id = (select auth.uid())))
    or (select public.is_staff())
  );

create policy filing_documents_select on public.filing_documents for select to authenticated
  using ((user_id = (select auth.uid()) and visible_to_customer) or (select public.is_staff()));

create policy filing_receipts_select on public.filing_receipts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy reminders_select on public.reminders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Customer-writable workflow tables
-- ---------------------------------------------------------------------------

create policy filing_answers_select on public.filing_answers for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy filing_answers_insert_own on public.filing_answers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.filings f
                where f.id = filing_id and f.user_id = (select auth.uid())
                  and f.status in ('draft', 'needs_information', 'needs_customer_action'))
  );
create policy filing_answers_update_own on public.filing_answers for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.filings f
                where f.id = filing_id and f.user_id = (select auth.uid())
                  and f.status in ('draft', 'needs_information', 'needs_customer_action'))
  )
  with check (user_id = (select auth.uid()));
revoke update on public.filing_answers from anon, authenticated;
grant update (answers, completed_steps, is_complete) on public.filing_answers to authenticated;

create policy filing_authorizations_select on public.filing_authorizations for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
-- Authorizations are legal evidence: only the server (service role) records them,
-- so the snapshot, hash and request metadata cannot be forged by the client.


create policy messages_select on public.messages for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
create policy messages_insert_own on public.messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and author_id = (select auth.uid())
    and author_type = 'customer'
    and exists (select 1 from public.filings f
                where f.id = filing_id and f.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Staff-only tables (read by staff; written by the server)
-- ---------------------------------------------------------------------------

create policy admin_notes_staff on public.admin_notes for select to authenticated
  using ((select public.is_staff()));
create policy assignments_staff on public.assignments for select to authenticated
  using ((select public.is_staff()));
create policy audit_logs_staff on public.audit_logs for select to authenticated
  using ((select public.is_staff()));
create policy payment_events_staff on public.payment_events for select to authenticated
  using ((select public.is_staff()));
create policy analytics_events_staff on public.analytics_events for select to authenticated
  using ((select public.is_staff()));
create policy reminder_schedules_staff on public.reminder_schedules for select to authenticated
  using ((select public.is_staff()));
create policy notification_templates_staff on public.notification_templates for select to authenticated
  using ((select public.is_staff()));
create policy waitlist_staff on public.waitlist for select to authenticated
  using ((select public.is_staff()));
-- sandbox_checkout_sessions and rate_limits: no policies => service role only.
