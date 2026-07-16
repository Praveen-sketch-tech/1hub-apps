# Installation guide

## 1. Prerequisites

- Node.js 20+
- npm 10+
- A free [Supabase](https://supabase.com) account

## 2. Get the code running locally

```bash
npm install
cp .env.example .env
```

`npm install` may report a small number of moderate/high vulnerabilities — these come from
transitive devDependencies (Vite/PWA tooling), not runtime code shipped to the browser.
Don't run `npm audit fix --force`; it can silently jump major versions of Vite/ESLint and
break the build. Review `npm audit` output and upgrade individual packages deliberately
when you're ready instead.

Fill in `.env` with your Supabase project URL and anon key (see step 3 below), then:

```bash
npm run dev
```

Visit `http://localhost:5173`.

## 3. Set up Supabase

Full instructions are in [`supabase/README.md`](./supabase/README.md). Short version:

**New project:**
1. Create a new project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`, then `supabase/policies.sql`.

**Existing Hub Apps project (replacing an earlier version of this codebase):**
1. In the SQL editor, run `supabase/migrations/fix_base_platform.sql` instead. It's safe to
   run on a database that already has data — it won't drop tables or delete users.

Then, either way:
- In **Project Settings → API**, copy the **Project URL** and **anon public key** into
  your `.env` file as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- (Optional) In **Authentication → URL Configuration**, set the site URL and add
  `http://localhost:5173/reset-password` as a redirect URL for local development.
- To make your own account an admin, run this once in the SQL editor after signing up:
  ```sql
  update public.profiles set role = 'admin' where email = 'you@example.com';
  ```

## 4. GitHub Codespaces

This repo includes a `.devcontainer/devcontainer.json`. Opening it in Codespaces will
automatically run `npm install`. Add your `.env` file (Codespaces → Secrets, or create it
manually) before running `npm run dev`.

## 5. Production build

```bash
npm run build
npm run preview
```

The build output is a static `dist/` folder — deploy it to any static host and set the
same environment variables there.

## 6. Using this as the base for a new app

Copy this whole project into a new repository, rename it, update `package.json` and
`index.html`, point `.env` at a new Supabase project (or reuse this one), and start adding
feature folders under `src/apps/`.
