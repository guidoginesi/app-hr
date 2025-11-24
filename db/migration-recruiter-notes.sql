-- Tabla para notas del reclutador sobre candidatos
create table if not exists public.recruiter_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_recruiter_notes_application on public.recruiter_notes(application_id);
create index if not exists idx_recruiter_notes_user on public.recruiter_notes(user_id);
create index if not exists idx_recruiter_notes_created_at on public.recruiter_notes(created_at desc);

-- Trigger para actualizar updated_at automáticamente
create trigger update_recruiter_notes_updated_at
  before update on public.recruiter_notes
  for each row
  execute function update_updated_at_column();

-- Solo un admin puede tener múltiples notas por aplicación (histórico)
-- Pero solo mostramos la más reciente como "nota actual"

