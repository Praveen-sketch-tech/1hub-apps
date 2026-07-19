-- Hub Apps — fix_base_platform.sql
--
-- SAFE to run against an EXISTING Hub Apps Supabase project. It does not
-- drop any table, does not touch auth.users, and does not delete data.
-- It only:
--   - updates the analytics_events event_type check constraint
--   - re-creates functions/triggers (CREATE OR REPLACE / DROP ... IF EXISTS)
--   - re-creates RLS policies (DROP POLICY IF EXISTS + CREATE POLICY)
--   - adds any missing GRANTs
--   - backfills any auth.users rows that don't have a matching profiles row
--
-- Run this once in the Supabase SQL editor.

begin;

-- ============================================================
-- 1. Make sure every existing auth.users row has a profiles row.
--    Uses ON CONFLICT so it's safe to run more than once.
-- ============================================================
insert into public.profiles (id, full_name, email)
select u.id, u.raw_user_meta_data ->> 'full_name', u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ============================================================
-- 2. Update the analytics_events event_type constraint to allow
--    'session_end' (used instead of updating analytics_sessions rows).
-- ============================================================
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'analytics_events'
      and constraint_name = 'analytics_events_event_type_check'
  ) then
    alter table public.analytics_events drop constraint analytics_events_event_type_check;
  end if;
end $$;

alter table public.analytics_events
  add constraint analytics_events_event_type_check
  check (event_type in ('page_view', 'feature_usage', 'error', 'feedback_submitted', 'session_end'));

-- ============================================================
-- 3. Recreate functions/triggers (idempotent).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer set search_path = public stable;

create or replace function public.prevent_role_self_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute procedure public.prevent_role_self_escalation();

-- ============================================================
-- 4. Re-create RLS policies (drops any old/insecure versions first,
--    including the insecure `using (true)` UPDATE policy on
--    analytics_sessions).
-- ============================================================
alter table public.profiles enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.feedback enable row level security;
alter table public.logs enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "Anyone can insert a session" on public.analytics_sessions;
drop policy if exists "Anyone can update their own session" on public.analytics_sessions;
create policy "Sessions can be created by their owner or anonymously" on public.analytics_sessions
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read all sessions" on public.analytics_sessions;
create policy "Admins can read all sessions" on public.analytics_sessions
  for select
  using (public.is_admin());

drop policy if exists "Anyone can insert an event" on public.analytics_events;
create policy "Events can be created by their owner or anonymously" on public.analytics_events
  for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read all events" on public.analytics_events;
create policy "Admins can read all events" on public.analytics_events
  for select
  using (public.is_admin());

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

drop policy if exists "Authenticated users can write logs" on public.logs;
drop policy if exists "Authenticated users can write their own logs" on public.logs;
create policy "Authenticated users can write their own logs" on public.logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can read logs" on public.logs;
create policy "Admins can read logs" on public.logs
  for select
  using (public.is_admin());

drop policy if exists "Anyone can read app settings" on public.app_settings;
create policy "Anyone can read app settings" on public.app_settings
  for select
  using (true);

drop policy if exists "Admins can modify app settings" on public.app_settings;
drop policy if exists "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings
  for insert
  with check (public.is_admin());

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- storage: avatars
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

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
-- 5. Grants (idempotent — GRANT is a no-op if already granted).
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;

grant insert on public.analytics_sessions to anon, authenticated;
grant select on public.analytics_sessions to authenticated;

grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;

grant insert on public.feedback to anon, authenticated;
grant select on public.feedback to authenticated;

grant insert on public.logs to authenticated;
grant select on public.logs to authenticated;

grant select on public.app_settings to anon, authenticated;
grant insert, update on public.app_settings to authenticated;

commit;

-- ============================================================
-- After running this migration, verify the backfill:
--   select id, full_name, email, mobile, role from public.profiles order by created_at desc;
-- And confirm your own account is an admin:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================
