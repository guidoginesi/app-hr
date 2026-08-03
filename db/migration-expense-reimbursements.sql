-- Módulo de reintegros de gastos (Asana 1217024607713461).
--
-- Circuito: el colaborador carga el gasto con comprobante obligatorio → lo aprueba
-- su líder → Administración valida el comprobante fiscal y la imputación y agenda
-- el pago → se marca pagado con su comprobante.
--
-- ── Decisiones cerradas con Guido (2026-08-03) ────────────────────────────────
-- · Habilitación POR PERSONA: el módulo NO es para todo el equipo. Se habilita
--   con una lista explícita (expense_reimbursement_access), administrada por
--   People, con alta en lote por área. Se eligió sobre "por área" y "por tipo de
--   contrato" porque esos dos habilitan o quitan el acceso solo cuando alguien
--   cambia de área o de contrato, sin que nadie lo haya decidido.
-- · Imputación a cliente/proyecto: TABLA (expense_projects) y no texto libre. Con
--   texto libre "Acme", "acme" y "ACME S.A." son tres filas distintas y el reporte
--   por cliente —que es la mitad del valor del módulo— queda roto de entrada.
--   El campo es OPCIONAL: null = gasto no imputable.
-- · Monedas ARS y USD. El USD se convierte a ARS una sola vez, cuando
--   Administración valida, con un TC que tipea a mano. Capacitaciones convierte
--   dos veces con dos MEP distintos y es su parte más frágil.
-- · Monto parcial: Administración puede aprobar por menos de lo pedido con
--   comentario obligatorio, en vez de rechazar y pedir de nuevo.
-- · Relación de dependencia se paga por transferencia: su recibo es un PDF
--   externo, así que no se puede computar por liquidación.
-- · Sin líder cargado, la solicitud va a la cola de People.

-- ── Enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type reimbursement_status as enum (
    'requested', 'leader_approved', 'admin_validated', 'to_pay', 'paid', 'rejected', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reimbursement_currency as enum ('ARS', 'USD');
exception when duplicate_object then null; end $$;

-- Enum y no tabla: son seis y cambian una vez por año. `alter type ... add value`
-- es un one-liner; una tabla sumaría un CRUD para mantener.
do $$ begin
  create type reimbursement_category as enum (
    'viaticos', 'movilidad', 'comidas', 'insumos', 'suscripciones', 'otros'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reimbursement_receipt_type as enum (
    'factura_a', 'factura_b', 'factura_c', 'ticket', 'recibo', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reimbursement_payment_method as enum ('payroll', 'transfer');
exception when duplicate_object then null; end $$;

-- ── Habilitación por persona ─────────────────────────────────────────────────
create table if not exists public.expense_reimbursement_access (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  granted_by  uuid references auth.users(id) on delete set null,
  granted_at  timestamptz not null default now(),
  note        text
);

comment on table public.expense_reimbursement_access is
  'Quiénes pueden usar el módulo de reintegros. Estar en esta tabla es la única condición: no hay fallback por área ni por contrato.';

-- ── Clientes / proyectos para imputar ────────────────────────────────────────
create table if not exists public.expense_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  client_name text,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Case-insensitive: sin esto vuelve por la ventana el problema que la tabla
-- venía a resolver ("Acme" y "acme" como dos proyectos distintos).
create unique index if not exists uniq_expense_projects_name on public.expense_projects (lower(name));

-- ── Solicitudes ──────────────────────────────────────────────────────────────
create table if not exists public.expense_reimbursements (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  -- Se congela al crear, no se lee en vivo de employees.manager_id: si la persona
  -- cambia de líder a mitad del circuito, el aprobador no se muda.
  leader_id   uuid references public.employees(id) on delete set null,

  -- Gasto
  expense_date date not null,
  category     reimbursement_category not null,
  concept      text not null,
  amount       numeric(12,2) not null check (amount > 0),
  currency     reimbursement_currency not null default 'ARS',

  -- Imputación (opcional). El snapshot del label preserva el reporte histórico
  -- si el proyecto se renombra o se desactiva.
  project_id             uuid references public.expense_projects(id) on delete set null,
  project_label_snapshot text,

  -- Comprobante: obligatorio por definición del negocio.
  receipt_type     reimbursement_receipt_type not null,
  receipt_number   text,
  supplier_cuit    text check (supplier_cuit is null or supplier_cuit ~ '^[0-9]{11}$'),
  receipt_path     text not null,
  receipt_filename text,
  receipt_size     integer,
  receipt_mime     text,

  status reimbursement_status not null default 'requested',

  -- Líder
  leader_approved_by uuid references auth.users(id) on delete set null,
  leader_approved_at timestamptz,
  leader_comment     text,

  -- Administración
  admin_validated_by  uuid references auth.users(id) on delete set null,
  admin_validated_at  timestamptz,
  admin_comment       text,
  fiscal_receipt_ok   boolean not null default false,
  imputation_ok       boolean not null default false,
  -- null = se aprueba el monto pedido completo. Los reportes usan
  -- coalesce(approved_amount, amount).
  approved_amount     numeric(12,2) check (approved_amount is null or approved_amount > 0),

  -- Rechazo / cancelación
  rejected_by      uuid references auth.users(id) on delete set null,
  rejected_at      timestamptz,
  rejection_reason text,
  cancelled_by     uuid references auth.users(id) on delete set null,
  cancelled_at     timestamptz,

  -- Pago
  payment_method         reimbursement_payment_method,
  pay_year               integer,
  pay_month              integer check (pay_month is null or pay_month between 1 and 12),
  estimated_payment_date date,
  amount_ars             numeric(12,2),
  fx_rate                numeric(12,4),
  fx_at                  timestamptz,
  applied_period_id      uuid references public.payroll_periods(id) on delete set null,
  paid_by                uuid references auth.users(id) on delete set null,
  paid_at                timestamptz,
  payment_receipt_path   text,

  -- Snapshot de la política vigente al solicitar, para que un reintegro viejo no
  -- se relea con reglas nuevas.
  validations jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reimb_employee on public.expense_reimbursements (employee_id, created_at desc);
create index if not exists idx_reimb_status   on public.expense_reimbursements (status);
create index if not exists idx_reimb_leader   on public.expense_reimbursements (leader_id) where status = 'requested';
create index if not exists idx_reimb_pay      on public.expense_reimbursements (pay_year, pay_month);

-- ── Trazabilidad ─────────────────────────────────────────────────────────────
-- A diferencia de adelantos y capacitaciones, esta tabla NO es write-only: se
-- muestra como timeline en el detalle, también del lado del colaborador. La tarea
-- pide "fecha y responsable de cada cambio", así que es requisito.
create table if not exists public.expense_reimbursement_events (
  id               uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references public.expense_reimbursements(id) on delete cascade,
  event_type       text not null,
  from_status      reimbursement_status,
  to_status        reimbursement_status,
  actor_user_id    uuid references auth.users(id) on delete set null,
  -- Denormalizado al escribir: no hay helper uuid→nombre en el repo y el join
  -- contra employees.user_id se rompe cuando la persona se da de baja.
  actor_name       text,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_reimb_events on public.expense_reimbursement_events (reimbursement_id, created_at);

-- ── Vista con detalles ───────────────────────────────────────────────────────
-- Columnas explícitas y no r.*: en adelantos, el select con estrella obligó a un
-- DROP + CREATE de la vista al agregar una columna.
create or replace view public.expense_reimbursements_with_details
with (security_invoker = true) as
select
  r.id, r.employee_id, r.leader_id,
  r.expense_date, r.category, r.concept, r.amount, r.currency,
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
  trim(concat_ws(' ', e.first_name, e.last_name))  as employee_name,
  coalesce(e.work_email, e.personal_email)         as employee_email,
  e.user_id                                        as employee_user_id,
  e.department_id                                  as department_id,
  e.employment_type                                as employment_type,
  d.name                                           as department_name,
  trim(concat_ws(' ', l.first_name, l.last_name))  as leader_name,
  p.name                                           as project_name,
  p.client_name                                    as project_client
from public.expense_reimbursements r
join public.employees e on e.id = r.employee_id
left join public.employees l on l.id = r.leader_id
left join public.departments d on d.id = e.department_id
left join public.expense_projects p on p.id = r.project_id;

-- ── Storage ──────────────────────────────────────────────────────────────────
-- Privado. Los mimes se declaran en el bucket, igual que inquiry-files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reimbursement-files', 'reimbursement-files', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ── Permisos ─────────────────────────────────────────────────────────────────
alter table public.expense_reimbursement_access enable row level security;
alter table public.expense_projects              enable row level security;
alter table public.expense_reimbursements        enable row level security;
alter table public.expense_reimbursement_events  enable row level security;

-- La app escribe con service_role, así que el revoke explícito es la barrera
-- real. Sin esto pasa lo de salary_advances, donde authenticated conserva el
-- INSERT y con la policy de "crear el propio" se puede insertar una fila ya
-- aprobada, salteándose todo el circuito.
revoke insert, update, delete on public.expense_reimbursement_access from anon, authenticated;
revoke insert, update, delete on public.expense_projects              from anon, authenticated;
revoke insert, update, delete on public.expense_reimbursements        from anon, authenticated;
revoke insert, update, delete on public.expense_reimbursement_events  from anon, authenticated;
-- La VISTA también recibe los grants por defecto de Supabase y es fácil de olvidar.
-- Con un join no es actualizable, así que un INSERT fallaría igual, pero se revoca
-- para no dejar el permiso colgado.
revoke insert, update, delete on public.expense_reimbursements_with_details from anon, authenticated;

-- Lectura: cada persona ve lo suyo. Todo lo demás pasa por la API.
drop policy if exists "own reimbursements" on public.expense_reimbursements;
create policy "own reimbursements" on public.expense_reimbursements
  for select using (
    employee_id in (select id from public.employees where user_id = auth.uid())
  );

drop policy if exists "own reimbursement events" on public.expense_reimbursement_events;
create policy "own reimbursement events" on public.expense_reimbursement_events
  for select using (
    reimbursement_id in (
      select r.id from public.expense_reimbursements r
      join public.employees e on e.id = r.employee_id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "read own access" on public.expense_reimbursement_access;
create policy "read own access" on public.expense_reimbursement_access
  for select using (
    employee_id in (select id from public.employees where user_id = auth.uid())
  );

-- Los proyectos activos los lee cualquiera con sesión: el selector del formulario
-- los necesita y no son información sensible.
drop policy if exists "read active projects" on public.expense_projects;
create policy "read active projects" on public.expense_projects
  for select using (active = true);
