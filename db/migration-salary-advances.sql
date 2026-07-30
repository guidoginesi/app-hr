-- Migration: Módulo de Adelanto de Sueldos (Fase 1)
-- ---------------------------------------------------------------
-- Registro + workflow de solicitudes de adelanto de sueldo.
-- Molde: módulo de Time Off (leave_requests). Roles simplificados: cualquier
-- admin cubre RRHH y Administración en Fase 1.

-- Estados del flujo
DO $$ BEGIN
  CREATE TYPE salary_advance_status AS ENUM (
    'pending_hr', 'pending_admin', 'approved', 'transferred', 'settled', 'rejected', 'blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de solicitud
DO $$ BEGIN
  CREATE TYPE salary_advance_type AS ENUM ('standard', 'exception', 'emergency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.salary_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text,
  type salary_advance_type NOT NULL DEFAULT 'standard',
  status salary_advance_status NOT NULL DEFAULT 'pending_hr',
  -- snapshot de las reglas automáticas al momento de solicitar
  validations jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- mes en que se descuenta en liquidación
  discount_year int NOT NULL,
  discount_month int NOT NULL CHECK (discount_month BETWEEN 1 AND 12),
  balance_pending numeric(12,2) NOT NULL DEFAULT 0,
  -- RRHH confirma manualmente que no hay renuncia comunicada (regla 8)
  no_resignation_confirmed boolean NOT NULL DEFAULT false,
  -- aprobación 1 (RRHH)
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  hr_note text,
  -- aprobación 2 (Administración) + validación manual del 50% (regla 3)
  admin_approved_by uuid,
  admin_approved_at timestamptz,
  admin_note text,
  -- rechazo (cualquier paso)
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  -- transferencia y saldado
  transferred_by uuid,
  transferred_at timestamptz,
  settled_at timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_advances_employee ON public.salary_advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_advances_status ON public.salary_advances(status);
CREATE INDEX IF NOT EXISTS idx_salary_advances_requested_at ON public.salary_advances(requested_at);

-- Log de eventos para trazabilidad (mirror de la lógica de Time Off)
CREATE TABLE IF NOT EXISTS public.salary_advance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.salary_advances(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status salary_advance_status,
  to_status salary_advance_status,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_advance_events_advance ON public.salary_advance_events(advance_id);

-- Vista con datos del empleado (mirror de leave_requests_with_details)
CREATE OR REPLACE VIEW public.salary_advances_with_details
WITH (security_invoker = true) AS
  SELECT sa.*,
    concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.employment_type,
    e.hire_date,
    e.status AS employee_status,
    e.user_id AS employee_user_id,
    coalesce(e.work_email, e.personal_email) AS employee_email
  FROM public.salary_advances sa
  JOIN public.employees e ON sa.employee_id = e.id;

-- RLS: el empleado ve/crea las suyas; las mutaciones de admin van por API con
-- service role (bypass RLS), igual que Time Off.
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees view own advances" ON public.salary_advances;
CREATE POLICY "Employees view own advances" ON public.salary_advances
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Employees create own advances" ON public.salary_advances;
CREATE POLICY "Employees create own advances" ON public.salary_advances
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Employees view own advance events" ON public.salary_advance_events;
CREATE POLICY "Employees view own advance events" ON public.salary_advance_events
  FOR SELECT USING (
    advance_id IN (
      SELECT id FROM public.salary_advances
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );
