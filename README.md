This is a Next.js app for Pow to receive CVs and analyze candidates with AI.

## Setup

1) Environment variables (copy `env.example` to `.env.local` and fill):

```bash
cp env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `OPENAI_API_KEY`

2) Database (Supabase Postgres) [[remote instance is used]](memory:4421974)

Run the SQL in `db/schema.sql` on your Supabase project to create tables:
- `jobs`, `candidates`, `applications`

3) Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to see the public landing with published jobs and the application form.

## What’s implemented (Phase 1-2)
- Reception of CVs: public page lists published jobs and accepts applications with resume upload.
- Storage: resumes uploaded to Supabase Storage bucket `resumes` (public).
- AI Analysis: two separate server endpoints:
  - `POST /api/ai/extract` extracts structured candidate info from the resume.
  - `POST /api/ai/score` compares resume vs job description and returns a 0-100 score.
- Pipeline status is set to `Recibido` then `Analizado por IA` after processing.

## Deploy on Vercel
- Add the same env vars in the Vercel project.
- Ensure the Supabase tables exist (run `db/schema.sql`).
- Push to your Git repository to deploy.

