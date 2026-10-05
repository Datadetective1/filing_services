-- Owner checks: the owner's progress on the human state checks (Washington portal
-- walkthrough, counsel review, Nevada and Utah calls and portal walkthroughs).
--
-- One row per checklist item (keys defined in src/lib/admin/owner-checks.ts): whether it
-- is done and the exact state response / portal wording the owner recorded. Read and
-- written only by the admin console through the service role, after requireAdmin().
-- Every save is also written to the append-only audit log.

create table if not exists public.owner_checks (
  item_key text primary key check (item_key ~ '^[a-z0-9_.-]{1,80}$'),
  done boolean not null default false,
  note text check (note is null or char_length(note) <= 4000),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.owner_checks enable row level security;
-- No policies: neither anon nor authenticated users can read or write it.
revoke all on public.owner_checks from anon, authenticated;
