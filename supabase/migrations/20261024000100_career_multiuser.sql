-- Career.Agency phase 1. Public jobs remain static; personal records are private.
-- Apply only to a dedicated Supabase project (not the legacy dashboard data).
create table if not exists public.career_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint career_profiles_name_length check (char_length(display_name) <= 80)
);
create table if not exists public.career_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('feedback', 'workspace')),
  payload jsonb not null,
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind),
  constraint career_snapshot_object check (jsonb_typeof(payload) = 'object'),
  constraint career_snapshot_size check (octet_length(payload::text) <= 10485760),
  constraint career_snapshot_format check (
    (kind = 'feedback' and payload ->> 'type' = 'bewerbungs-agent-feedback'
      and payload ->> 'schema_version' = '1.0.0')
    or (kind = 'workspace' and payload ->> 'type' = 'bewerbungs-agent-workspace'
      and payload ->> 'schema_version' = '0.3.0')
  )
);
alter table public.career_profiles enable row level security;
alter table public.career_snapshots enable row level security;
alter table public.career_profiles force row level security;
alter table public.career_snapshots force row level security;

-- RLS is NOT a substitute for privilege grants. No anonymous access, no TRUNCATE.
revoke all on public.career_profiles from public, anon, authenticated;
revoke all on public.career_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.career_profiles to authenticated;
grant select, insert, update, delete on public.career_snapshots to authenticated;

create policy "profile own read" on public.career_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "profile own create" on public.career_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profile own edit" on public.career_profiles
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "profile own remove" on public.career_profiles
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "snapshot own read" on public.career_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "snapshot own create" on public.career_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "snapshot own edit" on public.career_snapshots
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "snapshot own remove" on public.career_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No broad storage bucket yet: later documents require an independent private-bucket RLS migration.
