-- Tabla para historial de calificaciones del reclutador
create table if not exists public.rating_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  note text,
  created_at timestamptz not null default now()
);

-- Índices para performance
create index if not exists idx_rating_history_application on public.rating_history(application_id);
create index if not exists idx_rating_history_user on public.rating_history(user_id);
create index if not exists idx_rating_history_created_at on public.rating_history(created_at desc);

-- Comentarios
comment on table public.rating_history is 'Historial de calificaciones del reclutador sobre candidatos';
comment on column public.rating_history.rating is 'Calificación de 1 a 5 estrellas';
comment on column public.rating_history.note is 'Nota opcional del reclutador al calificar';



