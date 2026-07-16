-- Hub Apps — Row Level Security policies
-- Run after schema.sql (fresh project) or as part of
-- supabase/migrations/fix_base_platform.sql (existing project).
--
-- IMPORTANT: RLS policies only restrict which ROWS a role can see/touch.
-- They do NOT grant privileges on the table itself — Postgres denies any
-- operation the role hasn't been GRANTed at all, before RLS is even
-- evaluated. The GRANT statements at the bottom of this file are required;
-- without them, inserts (e.g. feedback submission) fail even though the
-- matching RLS policy looks correct.

alter table public.profiles enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feedback enable row level security;
alter table public.logs enable row level security;
alter table public.app_settings enable row level security;

-- Helper: is the current user an admin? SECURITY DEFINER + owned by a
-- superuser role (the default when created via the SQL editor) means this
-- bypasses RLS internally, so it does not recurse into the profiles
-- policies below.
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer set search_path = public stable;

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- No INSERT/DELETE policy: rows are only ever created by the
-- handle_new_user() trigger (which runs as SECURITY DEFINER and bypasses
-- RLS) and are never deleted directly by clients.

-- ============================================================
-- analytics_sessions (append-only — no UPDATE policy at all)
-- ============================================================
drop policy if exists "Anyone can insert a session" on public.analytics_sessions;
drop policy if exists "Anyone can update their own session" on public.analytics_sessions;
create policy "Sessions can be created by their owner or anonymously" on public.analytics_sessions
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read all sessions" on public.analytics_sessions;
create policy "Admins can read all sessions" on public.analytics_sessions
  for select
  using (public.is_admin());

-- ============================================================
-- analytics_events (append-only — no UPDATE policy at all)
-- ============================================================
drop policy if exists "Anyone can insert an event" on public.analytics_events;
create policy "Events can be created by their owner or anonymously" on public.analytics_events
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read all events" on public.analytics_events;
create policy "Admins can read all events" on public.analytics_events
  for select
  using (public.is_admin());

-- ============================================================
-- feedback
-- ============================================================
drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Feedback can be submitted by its owner or anonymously" on public.feedback
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read all feedback" on public.feedback;
create policy "Admins can read all feedback" on public.feedback
  for select
  using (public.is_admin());

drop policy if exists "Users can read their own feedback" on public.feedback;
create policy "Users can read their own feedback" on public.feedback
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- logs — client error telemetry only, NOT a trusted audit log.
-- Anonymous visitors cannot write logs (avoids unlimited unauthenticated
-- writes); authenticated users can only log as themselves; only admins
-- can read.
-- ============================================================
drop policy if exists "Authenticated users can write logs" on public.logs;
create policy "Authenticated users can write their own logs" on public.logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can read logs" on public.logs;
create policy "Admins can read logs" on public.logs
  for select
  using (public.is_admin());

-- ============================================================
-- app_settings — publicly readable, admin-writable
-- ============================================================
drop policy if exists "Anyone can read app settings" on public.app_settings;
create policy "Anyone can read app settings" on public.app_settings
  for select
  using (true);

drop policy if exists "Admins can modify app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- storage: avatars
-- ============================================================
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- GRANTS — RLS policies above are meaningless without these. Supabase
-- normally sets these up by default for the public schema, but we set
-- them explicitly here so this file is correct on its own.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant insert on public.analytics_sessions to anon, authenticated;
grant select on public.analytics_sessions to authenticated; -- filtered to admins by RLS above

grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated; -- filtered to admins by RLS above

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated; -- filtered by RLS above (own rows or admin)

grant insert on public.logs to authenticated; -- filtered to self by RLS above
grant select on public.logs to authenticated; -- filtered to admins by RLS above

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated; -- filtered to admins by RLS above
