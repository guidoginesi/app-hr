-- Recepción de recibos: DDL complementario (aplicado en prod).
-- Incluye las migraciones que faltaban en el repo + el endurecimiento posterior
-- a la revisión de seguridad.

-- ─────────────────────────────────────────────────────────────
-- 1) Recordatorios
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payroll_receipt_reminders (
  id                uuid primary key default gen_random_uuid(),
  settlement_id     uuid not null references public.payroll_employee_settlements(id) on delete cascade,
  channel           text not null default 'email' check (channel in ('email','in_app')),
  sent_at           timestamptz not null default now(),
  sent_by           uuid references auth.users(id) on delete set null,
  automated         boolean not null default false,
  email_provider_id text,
  document_version  int not null default 1,
  created_at        timestamptz not null default now()
);
create index if not exists idx_prr_settlement on public.payroll_receipt_reminders(settlement_id, sent_at desc);
alter table public.payroll_receipt_reminders enable row level security;

drop policy if exists "reminders read" on public.payroll_receipt_reminders;
create policy "reminders read" on public.payroll_receipt_reminders
  for select using (exists (select 1 from public.user_roles ur
                             where ur.user_id = auth.uid() and ur.role in ('admin','administracion')));

drop policy if exists "reminders admin manage" on public.payroll_receipt_reminders;
create policy "reminders admin manage" on public.payroll_receipt_reminders
  for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 2) Versionado del recibo
-- ─────────────────────────────────────────────────────────────
alter table public.payroll_payslips
  add column if not exists version         int not null default 1,
  add column if not exists replaced_at     timestamptz,
  add column if not exists replaced_by     uuid references auth.users(id) on delete set null,
  add column if not exists replaced_reason text;

-- Reserva atómica de la versión (dos reemplazos concurrentes no pueden calcular
-- el mismo número y pisar el archivo del otro).
create or replace function public.bump_payslip_version(p_settlement_id uuid)
returns table (version int)
language sql security definer set search_path = public as $$
  update public.payroll_payslips
     set version = coalesce(version, 1) + 1
   where settlement_id = p_settlement_id
  returning version;
$$;
revoke all on function public.bump_payslip_version(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) Endurecimiento de las constancias (post revisión de seguridad)
-- ─────────────────────────────────────────────────────────────
-- Escritura SOLO por el route handler (service_role): sin esto, cualquier usuario
-- logueado podía insertar constancias vía PostgREST con la anon key — backdatear
-- la propia o registrar la de otra persona y dejarla bloqueada por el UNIQUE.
revoke insert, update, delete on public.payroll_receipt_acknowledgements from anon, authenticated;
revoke insert, update, delete on public.payroll_receipt_reminders from anon, authenticated;

drop policy if exists "own ack insert" on public.payroll_receipt_acknowledgements;
create policy "own ack insert" on public.payroll_receipt_acknowledgements
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.payroll_employee_settlements s
        join public.employees e on e.id = s.employee_id
       where s.id = settlement_id and s.status = 'SENT'
         and e.user_id = auth.uid() and e.id = employee_id
    )
  );

-- UNIQUE parcial: si una constancia queda archivada, se tiene que poder volver a
-- confirmar esa misma versión.
do $$
declare cname text;
begin
  select conname into cname from pg_constraint
   where conrelid = 'public.payroll_receipt_acknowledgements'::regclass and contype = 'u';
  if cname is not null then
    execute format('alter table public.payroll_receipt_acknowledgements drop constraint %I', cname);
  end if;
end $$;

create unique index if not exists uniq_pra_active
  on public.payroll_receipt_acknowledgements(settlement_id, document_version)
  where superseded_at is null;

-- ─────────────────────────────────────────────────────────────
-- 4) Vista: el acuse vale sólo para la versión VIGENTE del documento
--    (si el recibo se reemplaza, deja de contar como confirmado).
--    Ver migration-payroll-view-acknowledgement.sql para la definición completa;
--    la cláusula clave del LATERAL es:
--      AND a.document_version = COALESCE(ps.version, 1)
--      ORDER BY a.document_version DESC, a.acknowledged_at DESC
-- ─────────────────────────────────────────────────────────────
