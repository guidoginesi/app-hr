-- Recordatorios automáticos de factura pendiente (Monotributo).
--
-- El botón "Reclamar facturas" ya existía, pero era manual: alguien se tenía que
-- acordar, y el recordatorio no dejaba rastro. Sin rastro no hay cadencia: no se
-- puede saber si a esa persona ya se le escribió tres veces esta semana o
-- ninguna.
--
-- Esta tabla es lo que convierte el botón en un automatismo. Espeja a
-- payroll_receipt_reminders a propósito: mismo problema, misma forma.

create table if not exists public.payroll_invoice_reminders (
  id                uuid primary key default gen_random_uuid(),
  settlement_id     uuid not null references public.payroll_employee_settlements(id) on delete cascade,
  channel           text not null default 'email' check (channel in ('email','in_app')),
  sent_at           timestamptz not null default now(),
  -- NULL cuando lo mandó el cron; con user_id cuando lo apretó una persona.
  sent_by           uuid references auth.users(id) on delete set null,
  automated         boolean not null default false,
  email_provider_id text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_pir_settlement
  on public.payroll_invoice_reminders(settlement_id, sent_at desc);

alter table public.payroll_invoice_reminders enable row level security;

drop policy if exists "invoice reminders read" on public.payroll_invoice_reminders;
create policy "invoice reminders read" on public.payroll_invoice_reminders
  for select using (exists (select 1 from public.user_roles ur
                             where ur.user_id = auth.uid() and ur.role in ('admin','administracion')));

drop policy if exists "invoice reminders admin manage" on public.payroll_invoice_reminders;
create policy "invoice reminders admin manage" on public.payroll_invoice_reminders
  for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

comment on table public.payroll_invoice_reminders is
  'Un renglón por recordatorio de factura enviado. Es lo que le pone tope a la cadencia automática.';
