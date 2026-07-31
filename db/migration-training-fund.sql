-- Migration: Fondo de Capacitaciones (Fase 1 — modelo de datos)
-- ---------------------------------------------------------------
-- Circuito: solicitud → aprobación líder → aprobación HR → factura →
-- pago 50% inicial → certificado → pago 50% final. Budget en USD por persona/año.
-- Decisiones: MEP manual; USD fijado al aprobar; reintegro reusa "reintegro
-- extraordinario" en la liquidación (monotributo computado / dependencia informado),
-- auto-aplicado al crear el período; comprometido se libera solo al cancelar/rechazar;
-- cruce de año imputa al año de aprobación; roles existentes (admin=HR, administracion=Adm);
-- Guido aprueba a líderes; devoluciones fuera de alcance.

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE training_request_status AS ENUM (
    'requested',            -- solicitado
    'leader_approved',      -- aprobado por líder
    'hr_approved',          -- aprobado por HR (queda comprometido en el budget)
    'invoice_uploaded',     -- factura inicial cargada
    'initial_paid',         -- pago 50% inicial (en curso)
    'certificate_uploaded', -- certificado cargado
    'completed',            -- pago 50% final (finalizado)
    'rejected',             -- rechazado (líder o HR)
    'cancelled'             -- cancelado por el colaborador
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE training_currency AS ENUM ('USD', 'ARS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE training_modality AS ENUM ('online', 'presencial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Config de budget por año (global) ----------
CREATE TABLE IF NOT EXISTS public.training_budget_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL UNIQUE,
  default_amount_usd numeric(10,2) NOT NULL DEFAULT 500,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Override por persona/año (opcional)
CREATE TABLE IF NOT EXISTS public.training_budget_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year int NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year)
);

-- ---------- Solicitudes ----------
CREATE TABLE IF NOT EXISTS public.training_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  budget_year int NOT NULL, -- año de imputación (= año de aprobación/solicitud)
  -- Datos del curso
  course_name text NOT NULL,
  provider text,
  modality training_modality,
  hours numeric(6,1),
  start_date date,
  end_date date,
  link text,
  objective text,
  role_relation text,
  -- Costo y moneda
  cost numeric(12,2) NOT NULL CHECK (cost > 0),
  currency training_currency NOT NULL DEFAULT 'USD',
  cost_usd numeric(10,2),         -- USD fijado al aprobar HR (para ARS usa mep_at_approval)
  mep_at_approval numeric(12,4),  -- MEP usado para fijar cost_usd (si currency=ARS)
  -- Estado
  status training_request_status NOT NULL DEFAULT 'requested',
  -- Aprobación líder (o Guido si el solicitante es líder)
  leader_id uuid,
  leader_approved_by uuid,
  leader_approved_at timestamptz,
  leader_comment text,
  -- Aprobación HR
  hr_approved_by uuid,
  hr_approved_at timestamptz,
  hr_comment text,
  -- Rechazo / cancelación
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  cancelled_at timestamptz,
  -- Archivos (paths en Supabase Storage)
  invoice_initial_path text,
  invoice_final_path text,
  certificate_path text,
  -- Pagos (reintegro por liquidación)
  initial_paid_period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  initial_paid_amount_ars numeric(12,2),
  initial_paid_mep numeric(12,4),
  initial_paid_at timestamptz,
  final_paid_period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
  final_paid_amount_ars numeric(12,2),
  final_paid_mep numeric(12,4),
  final_paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_requests_employee ON public.training_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_requests_status ON public.training_requests(status);
CREATE INDEX IF NOT EXISTS idx_training_requests_year ON public.training_requests(budget_year);

-- ---------- Log de eventos ----------
CREATE TABLE IF NOT EXISTS public.training_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.training_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status training_request_status,
  to_status training_request_status,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_training_request_events_request ON public.training_request_events(request_id);

-- ---------- Vista con datos del empleado ----------
CREATE OR REPLACE VIEW public.training_requests_with_details
WITH (security_invoker = true) AS
  SELECT tr.*,
    concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.employment_type,
    e.hire_date,
    e.department_id,
    e.user_id AS employee_user_id,
    coalesce(e.work_email, e.personal_email) AS employee_email,
    concat(l.first_name, ' ', l.last_name) AS leader_name
  FROM public.training_requests tr
  JOIN public.employees e ON tr.employee_id = e.id
  LEFT JOIN public.employees l ON tr.leader_id = l.id;

-- ---------- RLS ----------
ALTER TABLE public.training_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_budget_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_budget_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees view own training requests" ON public.training_requests;
CREATE POLICY "Employees view own training requests" ON public.training_requests
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Employees create own training requests" ON public.training_requests;
CREATE POLICY "Employees create own training requests" ON public.training_requests
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Employees view own training events" ON public.training_request_events;
CREATE POLICY "Employees view own training events" ON public.training_request_events
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.training_requests
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can read budget config" ON public.training_budget_config;
CREATE POLICY "Anyone can read budget config" ON public.training_budget_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Employees read own budget override" ON public.training_budget_overrides;
CREATE POLICY "Employees read own budget override" ON public.training_budget_overrides
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Seed: budget 2026 = USD 500
INSERT INTO public.training_budget_config (year, default_amount_usd)
VALUES (2026, 500)
ON CONFLICT (year) DO NOTHING;
