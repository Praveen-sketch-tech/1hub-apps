# Supabase setup

> **Already have a Hub Apps Supabase project from an earlier version?**
> Don't re-run `schema.sql`/`policies.sql` from scratch — run
> [`migrations/fix_base_platform.sql`](./migrations/fix_base_platform.sql) instead. It's
> safe on an existing database: it won't drop tables, delete users, or touch data, and it's
> safe to run more than once.

## 1. Create a project

Go to [supabase.com](https://supabase.com) → New Project. Pick a name, password, and
region, and wait for it to finish provisioning.

## 2. Run the schema

Open **SQL Editor** in the Supabase dashboard and run, in order:

1. `schema.sql` — creates the `profiles`, `analytics_sessions`, `analytics_events`,
   `feedback`, `logs`, and `app_settings` tables, plus a trigger that creates a `profiles`
   row automatically whenever someone signs up, and the public `avatars` storage bucket.
2. `policies.sql` — enables Row Level Security on every table and adds policies so that:
   - users can read/update their own profile (only `full_name`, `mobile`, `avatar_url` —
     `role` changes are blocked server-side by a trigger even if attempted); admins can
     read/update all profiles
   - analytics sessions/events can be **inserted** by anyone (including anonymous
     visitors), but never updated — session duration is recorded as a separate
     `session_end` event instead of mutating the session row — and only admins can read them
   - feedback can be submitted by anyone, read by its author or an admin
   - logs can only be written by authenticated users about themselves, and only read by
     admins (these are client telemetry, not a trusted audit log)
   - app settings are readable by everyone, writable by admins only
   - avatar images are publicly readable; users can only upload/update/delete their own
     avatar
   - explicit `GRANT`s on every table for `anon`/`authenticated`, since RLS policies alone
     don't grant table access

## 3. Get your API credentials

**Project Settings → API**:

- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`

Put both in your `.env` file (see `.env.example`).

## 4. Configure auth redirects

**Authentication → URL Configuration**:

- Site URL: your deployed URL (or `http://localhost:5173` for local dev)
- Redirect URLs: add `http://localhost:5173/reset-password` (and your production
  equivalent) so the "forgot password" email link works correctly.

## 5. Create your first admin user

Sign up normally through the app, then in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Refresh the app — the "Admin" link will appear in the navbar.

## 6. Regenerating types (optional)

`src/core/supabase/types.ts` is hand-written to match `schema.sql`. If you use the
Supabase CLI and want generated types instead:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase gen types typescript --linked > src/core/supabase/types.ts
```

You'll then want to re-export the same convenience types (`ProfileRow`, etc.) that the
rest of the app imports from `@core/supabase/types` — or update those imports to match
the generated shape.
