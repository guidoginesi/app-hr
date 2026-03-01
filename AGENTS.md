# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is **app-hr**, a Next.js 16 HR management system for Pow. It has three main areas:
- **Public Jobs Portal** (`/jobs`) — public career page
- **Admin Panel** (`/admin`) — HR administration (recruiting, people, time-off, evaluations, objectives)
- **Employee Portal** (`/portal`) — self-service for employees

### Architecture

- **Framework**: Next.js 16 (App Router) with TypeScript and Tailwind CSS 4
- **Database/Auth/Storage**: Supabase (PostgreSQL + Auth + Storage)
- **Package Manager**: npm (see `package-lock.json`)
- **Optional APIs**: OpenAI (AI-powered CV analysis), Resend (transactional emails)

### Running locally

**Supabase (required):** Docker must be running, then start local Supabase:
```
npx supabase start
```
This provides PostgreSQL on port 54322, APIs on port 54321, and Studio on port 54323. Use `npx supabase status --output json` to get `ANON_KEY` and `SERVICE_ROLE_KEY` for `.env.local`.

**Database schema:** Apply `db/schema.sql` first, then migration files in `db/` against the local Postgres (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). Some data-specific migrations (bonus_days adjustments) may fail on a fresh database — this is expected and does not affect core functionality.

**Storage:** The `resumes` bucket must exist. Create it via Storage API or Supabase Studio if not present.

**Dev server:** `npm run dev` — runs on http://localhost:3000.

### Standard commands

| Task  | Command           |
|-------|-------------------|
| Dev   | `npm run dev`     |
| Build | `npm run build`   |
| Lint  | `npm run lint`    |
| Start | `npm run start`   |

### Non-obvious caveats

- The app redirects `/` to `/jobs` via middleware (returns 307).
- Lint produces ~300+ pre-existing errors (mostly `@typescript-eslint/no-explicit-any`); these are not blockers for build/dev.
- The `next.config.ts` has a hardcoded Supabase hostname for image remote patterns; local development images may not render through `next/image` unless you add `127.0.0.1` to the patterns (not required for core functionality).
- Admin and portal login require Supabase Auth users. Use `scripts/create-admin.mjs` to create an admin user.
- The `.env.local` file is gitignored; each environment needs its own copy from `env.example`.
