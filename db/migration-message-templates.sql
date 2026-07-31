-- Plantillas de mensajes manuales (con variables tipo {{nombre}}).
-- Tabla propia (email_templates está acoplada a las automatizaciones).
create table if not exists public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  title      text not null default '',
  body       text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

drop policy if exists "admins manage message_templates" on public.message_templates;
create policy "admins manage message_templates" on public.message_templates
  for all
  using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));
