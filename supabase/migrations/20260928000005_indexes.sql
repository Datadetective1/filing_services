-- Covering indexes for foreign keys on hot paths (Supabase performance advisor:
-- unindexed_foreign_keys). Low-volume reference tables are intentionally skipped.

create index if not exists filings_business_idx on public.filings (business_id);
create index if not exists filings_order_idx on public.filings (order_id);
create index if not exists filings_assigned_idx on public.filings (assigned_to) where assigned_to is not null;
create index if not exists filing_requirements_rule_idx on public.filing_requirements (rule_id);
create index if not exists filing_requirements_business_idx on public.filing_requirements (business_id, period_year);
create index if not exists orders_business_idx on public.orders (business_id);
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_provider_payment_idx on public.payments (provider, provider_payment_id);
create index if not exists refunds_payment_idx on public.refunds (payment_id);
create index if not exists refunds_order_idx on public.refunds (order_id);
create index if not exists reminders_business_idx on public.reminders (business_id);
create index if not exists reminders_requirement_idx on public.reminders (requirement_id, status);
create index if not exists notifications_filing_idx on public.notifications (filing_id);
create index if not exists messages_user_idx on public.messages (user_id);
create index if not exists filing_documents_user_idx on public.filing_documents (user_id);
create index if not exists filing_receipts_user_idx on public.filing_receipts (user_id);
create index if not exists sandbox_checkout_sessions_payment_idx on public.sandbox_checkout_sessions (payment_id);
