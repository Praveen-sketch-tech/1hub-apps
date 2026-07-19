-- Hub Apps — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.
-- If you already have a Hub Apps database from an earlier version, do NOT
-- re-run this file — use supabase/migrations/fix_base_platform.sql instead,
-- which is safe to run against an existing project.

-- ============================================================
-- 1. PROFILES
-- One row per auth.users row. Created automatically on signup
-- via the trigger below.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  mobile text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Defense in depth: even if the client somehow sends a `role` change (it
-- shouldn't — see SafeProfileUpdate in src/core/supabase/queries/profile.ts
-- and the RLS policies in policies.sql), silently discard role changes
-- attempted by anyone who isn't already an admin. Admins can still change
-- roles (e.g. via the Admin > Users page).
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
-- 2. ANALYTICS
-- Sessions and events are append-only / immutable — there is no UPDATE
-- policy on either table (see policies.sql). Session duration is recorded
-- as a `session_end` event rather than mutating the session row.
-- ============================================================
create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device text,
  browser text,
  os text,
  country text,
  is_returning boolean not null default false,
  started_at timestamptz not null default now(),
  -- Kept for schema compatibility; no longer written to after creation.
  ended_at timestamptz,
  duration_seconds numeric
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analytics_sessions(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in ('page_view', 'feature_usage', 'error', 'feedback_submitted', 'session_end')
  ),
  path text,
  label text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_session_id_idx on public.analytics_events (session_id);
create index if not exists analytics_sessions_started_at_idx on public.analytics_sessions (started_at desc);

-- ============================================================
-- 3. FEEDBACK
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('useful', 'not_useful', 'bug_report', 'suggestion', 'text')),
  message text,
  page text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. LOGS
-- Client-side telemetry only (errors caught in the app). NOT a trusted
-- audit log — anyone with the anon key can theoretically write to it, so
-- never treat rows here as verified/authoritative. Only authenticated
-- users may write, and only admins may read (see policies.sql).
-- ============================================================
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. APP SETTINGS (key/value store for admin-configurable settings)
-- ============================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. STORAGE — avatars bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
