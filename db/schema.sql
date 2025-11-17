-- Jobs table
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  location text,
  description text,
  requirements text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Candidates
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  linkedin_url text,
  created_at timestamptz not null default now()
);

-- Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_url text not null,
  status text not null default 'Recibido',
  ai_extracted jsonb,
  ai_score int,
  ai_reasons text[],
  ai_match_highlights text[],
  created_at timestamptz not null default now()
);

-- Helpful index
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_status on public.applications(status);

-- Admins table: link Supabase auth users to admin role
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);


