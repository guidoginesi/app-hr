-- Constancias de RECEPCIÓN del recibo de sueldo (no conformidad).
-- El colaborador tilda "Recibido" y queda registrado fecha/hora + identificación.
create table if not exists public.payroll_receipt_acknowledgements (
  id                          uuid primary key default gen_random_uuid(),
  settlement_id               uuid not null references public.payroll_employee_settlements(id) on delete cascade,
  employee_id                 uuid not null references public.employees(id) on delete cascade,
  user_id                     uuid references auth.users(id) on delete set null,
  acknowledged_at             timestamptz not null default now(),
  document_version            int not null default 1,
  document_path_snapshot      text,
  document2_path_snapshot     text,
  document_uploaded_at_snapshot timestamptz,
  source                      text not null default 'portal' check (source in ('portal','admin_manual')),
  ip                          text,
  user_agent                  text,
  superseded_at               timestamptz,
  notes                       text,
  created_at                  timestamptz not null default now(),
  unique (settlement_id, document_version)
);

create index if not exists idx_pra_settlement on public.payroll_receipt_acknowledgements(settlement_id);
create index if not exists idx_pra_employee   on public.payroll_receipt_acknowledgements(employee_id);
create index if not exists idx_pra_ack_at     on public.payroll_receipt_acknowledgements(acknowledged_at desc);
create index if not exists idx_pes_period_status on public.payroll_employee_settlements(period_id, status);

alter table public.payroll_receipt_acknowledgements enable row level security;

-- El colaborador ve e inserta SOLO lo propio. Admin gestiona todo. Administración solo lee.
-- Ninguna policy referencia manager_id: el líder queda afuera por construcción.
drop policy if exists "own ack select" on public.payroll_receipt_acknowledgements;
create policy "own ack select" on public.payroll_receipt_acknowledgements
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','administracion'))
  );

drop policy if exists "own ack insert" on public.payroll_receipt_acknowledgements;
create policy "own ack insert" on public.payroll_receipt_acknowledgements
  for insert with check (user_id = auth.uid());

drop policy if exists "admin ack manage" on public.payroll_receipt_acknowledgements;
create policy "admin ack manage" on public.payroll_receipt_acknowledgements
  for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
  with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- Grandfathering: los períodos ya publicados no piden acuse (si no, el día del deploy
-- quedan ~219 recibos "pendientes" y el cron dispara recordatorios masivos).
alter table public.payroll_periods
  add column if not exists requires_acknowledgement boolean not null default true;

update public.payroll_periods p
   set requires_acknowledgement = false
 where exists (select 1 from public.payroll_employee_settlements s
                where s.period_id = p.id and s.status = 'SENT');

-- NOTA: la vista payroll_settlements_with_details se recrea en
-- migration-payroll-view-acknowledgement.sql agregando, al final:
--   requires_acknowledgement, acknowledged_at, acknowledged_by_user_id, acknowledged_document_version
-- (LEFT JOIN LATERAL al último acuse no superseded). Preservar security_invoker = true.
