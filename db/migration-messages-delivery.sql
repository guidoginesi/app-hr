-- Fase 2 · Tramo 4: estado de entrega de mails + permiso de envío masivo.

-- 1) Nuevo valor de enum (correr APARTE, no puede usarse en la misma tx que lo define):
--    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'mass_sender';

-- 2) Grant + columnas + tabla de eventos:
insert into public.user_roles (user_id, role)
  select ur.user_id, 'mass_sender'::public.user_role
  from public.user_roles ur
  where ur.role = 'admin'
    and not exists (
      select 1 from public.user_roles x where x.user_id = ur.user_id and x.role = 'mass_sender'
    );

alter table public.message_recipients
  add column if not exists email_status      text,
  add column if not exists email_provider_id text,
  add column if not exists email_status_at   timestamptz;
create index if not exists idx_message_recipients_provider on public.message_recipients(email_provider_id);

create table if not exists public.message_email_events (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text,
  event_type      text not null,
  recipient_email text,
  payload         jsonb,
  created_at      timestamptz not null default now(),
  unique (provider_id, event_type)
);
