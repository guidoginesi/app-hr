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

-- Enum para provincias
create type provincia as enum ('CABA', 'GBA', 'OTRA');

-- Candidates
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  phone text,
  provincia provincia,
  linkedin_url text,
  created_at timestamptz not null default now()
);

-- Enums para el funnel de selección
create type stage as enum (
  'CV_RECEIVED',
  'HR_REVIEW',
  'FILTER_QUESTIONS',
  'HR_INTERVIEW',
  'LEAD_INTERVIEW',
  'EO_INTERVIEW',
  'REFERENCES_CHECK',
  'SELECTED_FOR_OFFER',
  'OFFER',
  'CLOSED'
);

create type stage_status as enum (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'DISCARDED_IN_STAGE',
  'ON_HOLD'
);

create type offer_status as enum (
  'PENDING_TO_SEND',
  'SENT',
  'ACCEPTED',
  'REJECTED_BY_CANDIDATE',
  'WITHDRAWN_BY_POW',
  'EXPIRED'
);

create type final_outcome as enum (
  'HIRED',
  'REJECTED_BY_POW',
  'REJECTED_BY_CANDIDATE',
  'ROLE_CANCELLED',
  'TALENT_POOL'
);

create type rejection_reason as enum (
  -- Para REJECTED_BY_POW
  'TECH_SKILLS_INSUFFICIENT',
  'CULTURAL_MISFIT',
  'SALARY_EXPECTATION_ABOVE_RANGE',
  'LACK_OF_EXPERIENCE',
  'SOFT_SKILLS_MISMATCH',
  'NO_SHOW',
  -- Para REJECTED_BY_CANDIDATE
  'ACCEPTED_OTHER_OFFER',
  'SALARY_TOO_LOW',
  'BENEFITS_INSUFFICIENT',
  'MODALITY_NOT_ACCEPTED',
  'LOCATION_ISSUE',
  'PERSONAL_REASON',
  'PROCESS_TAKES_TOO_LONG',
  -- General
  'OTHER'
);

-- Applications (actualizada con el nuevo modelo de funnel)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_url text not null,
  
  -- Nuevo modelo de funnel
  current_stage stage not null default 'CV_RECEIVED',
  current_stage_status stage_status not null default 'PENDING',
  offer_status offer_status,
  final_outcome final_outcome,
  final_rejection_reason rejection_reason,
  
  -- Campos legacy (mantenemos para compatibilidad durante migración)
  status text, -- Deprecated: usar current_stage + current_stage_status
  
  -- Campos de IA
  ai_extracted jsonb,
  ai_score int,
  ai_reasons text[],
  ai_match_highlights text[],
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stage History (historial de cambios de etapa)
create table if not exists public.stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage stage,
  to_stage stage not null,
  status stage_status not null,
  changed_by_user_id uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  notes text
);

-- Índices
create index if not exists idx_applications_job on public.applications(job_id);
create index if not exists idx_applications_candidate on public.applications(candidate_id);
create index if not exists idx_applications_stage on public.applications(current_stage);
create index if not exists idx_applications_stage_status on public.applications(current_stage_status);
create index if not exists idx_stage_history_application on public.stage_history(application_id);
create index if not exists idx_stage_history_changed_at on public.stage_history(changed_at);
create index if not exists idx_candidates_provincia on public.candidates(provincia);

-- Trigger para actualizar updated_at automáticamente
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_applications_updated_at
  before update on public.applications
  for each row
  execute function update_updated_at_column();

-- Admins table: link Supabase auth users to admin role
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
