-- Physical-mail pilot support (design/export only; nothing is purchased or sent).
--
-- Additive and backward compatible: a channel on campaigns (default 'email', so existing
-- rows keep their meaning), one more segment and template key (superset checks), and a
-- per-piece landing code on marketing_sends for click attribution from the printed URL.

alter table public.marketing_campaigns
  add column if not exists channel text not null default 'email' check (channel in ('email', 'mail'));

alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_segment_check;
alter table public.marketing_campaigns add constraint marketing_campaigns_segment_check
  check (segment in ('approaching_deadline', 'deadline_passed_outstanding', 'unknown_status', 'upcoming_deadline'));

alter table public.marketing_campaigns drop constraint if exists marketing_campaigns_template_key_check;
alter table public.marketing_campaigns add constraint marketing_campaigns_template_key_check
  check (template_key in ('pa_annual_report_reminder', 'pa_dec31_postcard'));

alter table public.marketing_sends
  add column if not exists landing_code text check (landing_code is null or landing_code ~ '^[A-Za-z0-9_-]{6,80}$');
create unique index if not exists marketing_sends_landing_code_idx on public.marketing_sends (landing_code) where landing_code is not null;
