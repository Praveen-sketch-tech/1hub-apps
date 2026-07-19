# Hub Apps

A production-ready starter platform — the base every future app is built on top of.

This is **not** a framework. It's a real, working application with authentication, user
profiles, self-hosted analytics, an admin panel, and a set of shared UI components. When a
new app is needed, this project is copied and extended.

## Tech stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- React Router
- Supabase (Auth, PostgreSQL, Storage, Row Level Security)
- PWA-ready (via `vite-plugin-pwa`)
- GitHub Codespaces compatible

## Quick start

```bash
npm install
cp .env.example .env      # then fill in your Supabase credentials
npm run dev
```

The app runs at `http://localhost:5173`.

See [`INSTALL.md`](./INSTALL.md) for full setup steps and [`supabase/README.md`](./supabase/README.md)
for backend setup.

## Folder structure

```
src/
  core/                # framework-agnostic app internals
    config/             # env access + app-wide constants (routes, etc.)
    supabase/            # supabase client, generated types, query functions
    contexts/           # React contexts: Auth, Theme, Toast
    hooks/               # useAuth, useTheme, useToast, useAnalytics, ...
    routes/              # route table + ProtectedRoute / AdminRoute guards
    types/               # shared TypeScript types
    utils/               # validators, formatters, device info

  shared/              # reusable, feature-agnostic UI
    components/
      ui/                # Button, Input, Card, Modal, Badge, Avatar, Spinner...
      layout/             # Navbar, Footer, AppLayout, AuthLayout, AdminLayout
      feedback/           # Toast viewport, feedback widget
      upload/             # generic FileUpload component
      search/             # GlobalSearch

  apps/                # feature modules (pages), one folder per feature
    auth/                # login, signup, forgot/reset password
    profile/             # profile + change password
    settings/            # user settings
    admin/               # admin dashboard, users, analytics, feedback, logs, settings, stats
    legal/               # privacy, terms, about, contact
    errors/              # 404, 500, maintenance, offline
    home/                # home + global search page

supabase/
  schema.sql           # tables + triggers (fresh projects only)
  policies.sql         # row level security policies (fresh projects only)
  migrations/
    fix_base_platform.sql  # safe to run against an EXISTING project — see supabase/README.md
  README.md            # backend setup instructions
```

`apps/` is intentionally flat and page-oriented — each feature owns its own pages and can
be copied wholesale into a new project. `core/` and `shared/` are where genuinely reusable
logic and components live; as more apps get built on top of this base, promote code here
only once it's actually needed in more than one place. Avoid speculative abstraction.

## Core modules included

- **Authentication** — login, signup, forgot/reset password, logout, session handling
- **User profile** — name, email, mobile, avatar upload, change password
- **Self-hosted analytics** — visitors, returning users, device/browser, session duration,
  page views, feature usage, errors, feedback — all stored in Supabase (no Google Analytics)
- **Admin panel** — dashboard, users, analytics, feedback, logs, app settings, app statistics
- **Theme** — light/dark mode, persisted, respects system preference by default
- **Settings** — notification preferences, language selector (future-ready)
- **Feedback** — useful / not useful / bug report / suggest next tool / free text
- **Notifications** — toast system (success / error / warning), push-ready structure
- **Global search** — static, extensible search index across the app
- **Legal pages** — privacy policy, terms, about, contact
- **Error pages** — 404, 500, maintenance, offline
- **File upload** — generic, validated, with preview (no OCR/processing logic yet)

## Future modules (architecture-ready, not implemented)

OCR, PDF, Image, Video, AI, Payments, Email, WhatsApp, Storage, Automation.

These are intentionally left out. When one is needed, add it as a new folder under
`src/apps/`, and promote any logic it needs into `src/core` or `src/shared` only once
it's shared by a second app.

## Changelog

**Fixes applied after initial testing in GitHub Codespaces + a real Supabase project:**

- Fixed missing `FeedbackRow` export (`src/core/types/index.ts`) that broke `npm run build`
- Fixed the Supabase `Database` type shape so queries no longer resolve to `never`
  (`src/core/supabase/types.ts`)
- Fixed `vite.config.ts` to use `node:url`/`fileURLToPath` instead of `__dirname` (ESM-safe),
  and added `@types/node`
- Removed the insecure `analytics_sessions` UPDATE policy (`using (true)`); session duration
  is now recorded as an immutable `session_end` event instead
- Added explicit `GRANT`s in `policies.sql` — RLS alone doesn't grant table access, which is
  why feedback submission was failing
- Added a server-side trigger (`guard_profile_role`) that blocks non-admins from changing
  their own `role`, plus a client-side allowlist (`SafeProfileUpdate`) so the app never even
  attempts to send it
- Fixed profile updates to fail loudly instead of silently (no more `.maybeSingle()`
  swallowing a missing row) and added `supabase/migrations/fix_base_platform.sql` to backfill
  any missing `profiles` rows safely
- `GlobalSearch` now filters out admin-only results for non-admin users
- Clearer error message when Supabase's password-reset email rate limit is hit

## Building for production

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploying

Any static host works (Vercel, Netlify, Cloudflare Pages, etc.) — `npm run build` outputs
a static `dist/` folder. Set the same environment variables from `.env.example` in your
host's dashboard.
