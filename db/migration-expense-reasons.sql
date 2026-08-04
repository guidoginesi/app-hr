-- El motivo del gasto pasa de enum fijo en el código a tabla configurable.
--
-- Pedido de Guido: "los motivos que sean configurables". El enum obligaba a un
-- deploy para agregar o retirar un motivo. Se siembra con los seis que ya estaban
-- definidos, así nadie arranca de cero.
--
-- Se pudo hacer sin migrar datos porque la tabla de reintegros estaba vacía: el
-- módulo todavía no se había usado. Con filas cargadas habría hecho falta un
-- backfill de reason_id contra el enum viejo antes de dropear la columna.

create table if not exists public.expense_reasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Case-insensitive, para que no convivan "Viáticos" y "viaticos".
create unique index if not exists uniq_expense_reasons_name on public.expense_reasons (lower(name));

insert into public.expense_reasons (name, sort_order) values
  ('Viáticos', 10), ('Movilidad', 20), ('Comidas de trabajo', 30),
  ('Insumos', 40), ('Suscripciones', 50), ('Otros', 900)
on conflict do nothing;

-- reason_id nullable + snapshot del nombre: si el motivo se renombra o se
-- desactiva, el reintegro histórico sigue diciendo con qué motivo se pidió, y el
-- reporte por motivo no se reescribe hacia atrás.
alter table public.expense_reimbursements
  add column if not exists reason_id uuid references public.expense_reasons(id) on delete set null,
  add column if not exists reason_label_snapshot text;

-- La vista depende de la columna vieja, así que se baja primero y se recrea abajo.
drop view if exists public.expense_reimbursements_with_details;

alter table public.expense_reimbursements drop column if exists category;
drop type if exists reimbursement_category;

alter table public.expense_reasons enable row level security;
revoke insert, update, delete on public.expense_reasons from anon, authenticated;

-- Los motivos activos los lee cualquiera con sesión: el selector los necesita.
drop policy if exists "read active reasons" on public.expense_reasons;
create policy "read active reasons" on public.expense_reasons
  for select using (active = true);

create view public.expense_reimbursements_with_details
with (security_invoker = true) as
select
  r.id, r.employee_id, r.leader_id,
  r.expense_date, r.reason_id, r.reason_label_snapshot, r.concept, r.amount, r.currency,
  r.project_id, r.project_label_snapshot,
  r.receipt_type, r.receipt_number, r.supplier_cuit,
  r.receipt_path, r.receipt_filename, r.receipt_size, r.receipt_mime,
  r.status,
  r.leader_approved_by, r.leader_approved_at, r.leader_comment,
  r.admin_validated_by, r.admin_validated_at, r.admin_comment,
  r.fiscal_receipt_ok, r.imputation_ok, r.approved_amount,
  r.rejected_by, r.rejected_at, r.rejection_reason,
  r.cancelled_by, r.cancelled_at,
  r.payment_method, r.pay_year, r.pay_month, r.estimated_payment_date,
  r.amount_ars, r.fx_rate, r.fx_at, r.applied_period_id,
  r.paid_by, r.paid_at, r.payment_receipt_path,
  r.validations, r.created_at, r.updated_at,
  trim(concat_ws(' ', e.first_name, e.last_name)) as employee_name,
  coalesce(e.work_email, e.personal_email) as employee_email,
  e.user_id as employee_user_id,
  e.department_id as department_id,
  e.employment_type as employment_type,
  d.name as department_name,
  trim(concat_ws(' ', l.first_name, l.last_name)) as leader_name,
  p.name as project_name,
  p.client_name as project_client,
  rs.name as reason_name
from public.expense_reimbursements r
join public.employees e on e.id = r.employee_id
left join public.employees l on l.id = r.leader_id
left join public.departments d on d.id = e.department_id
left join public.expense_projects p on p.id = r.project_id
left join public.expense_reasons rs on rs.id = r.reason_id;

-- La vista también recibe los grants por defecto de Supabase.
revoke insert, update, delete on public.expense_reimbursements_with_details from anon, authenticated;
