-- ============================================================
-- MIGRATION: Liquidaciones Mensuales (Payroll)
-- Monotributo + Relación de dependencia
-- ============================================================

-- Enum: contract type snapshot
DO $$ BEGIN
  CREATE TYPE payroll_contract_type AS ENUM ('MONOTRIBUTO', 'RELACION_DEPENDENCIA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum: period status
DO $$ BEGIN
  CREATE TYPE payroll_period_status AS ENUM ('DRAFT', 'IN_REVIEW', 'SENT', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum: settlement status
DO $$ BEGIN
  CREATE TYPE payroll_settlement_status AS ENUM ('DRAFT', 'READY_TO_SEND', 'SENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1) Payroll periods
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  year        int NOT NULL,
  month       int NOT NULL CHECK (month BETWEEN 1 AND 12),
  period_key  text NOT NULL UNIQUE,
  status      payroll_period_status NOT NULL DEFAULT 'DRAFT',
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

CREATE TRIGGER update_payroll_periods_updated_at
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Employee settlements (1 per employee per period)
CREATE TABLE IF NOT EXISTS public.payroll_employee_settlements (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id               uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id             uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type_snapshot  payroll_contract_type NOT NULL,
  currency                text NOT NULL DEFAULT 'ARS',
  status                  payroll_settlement_status NOT NULL DEFAULT 'DRAFT',
  sent_at                 timestamptz,
  sent_by                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_to                text,
  email_provider_id       text,
  notes_internal          text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id)
);

CREATE TRIGGER update_payroll_employee_settlements_updated_at
  BEFORE UPDATE ON public.payroll_employee_settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) Monotributo breakdown (1:1 with settlement when MONOTRIBUTO)
CREATE TABLE IF NOT EXISTS public.payroll_monotributo_breakdown (
  settlement_id             uuid PRIMARY KEY REFERENCES public.payroll_employee_settlements(id) ON DELETE CASCADE,
  sueldo                    numeric(12,2) NOT NULL DEFAULT 0,
  monotributo               numeric(12,2) NOT NULL DEFAULT 0,
  reintegro_internet        numeric(12,2) NOT NULL DEFAULT 0,
  reintegro_extraordinario  numeric(12,2) NOT NULL DEFAULT 0,
  plus_vacacional           numeric(12,2) NOT NULL DEFAULT 0,
  total_a_facturar          numeric(12,2) NOT NULL DEFAULT 0,
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_payroll_monotributo_breakdown_updated_at
  BEFORE UPDATE ON public.payroll_monotributo_breakdown
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) Payslips / Recibos de sueldo (1:1 with settlement when RELACION_DEPENDENCIA)
CREATE TABLE IF NOT EXISTS public.payroll_payslips (
  settlement_id     uuid PRIMARY KEY REFERENCES public.payroll_employee_settlements(id) ON DELETE CASCADE,
  pdf_storage_path  text,
  pdf_filename      text,
  pdf_uploaded_at   timestamptz,
  pdf_uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_period ON public.payroll_employee_settlements(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_employee ON public.payroll_employee_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_settlements_status ON public.payroll_employee_settlements(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_key ON public.payroll_periods(period_key);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON public.payroll_periods(status);

-- View: settlements with details
CREATE OR REPLACE VIEW public.payroll_settlements_with_details AS
SELECT
  s.*,
  p.year AS period_year,
  p.month AS period_month,
  p.period_key,
  p.status AS period_status,
  e.first_name,
  e.last_name,
  COALESCE(e.work_email, e.personal_email) AS employee_email,
  e.employment_type AS current_employment_type,
  mb.sueldo,
  mb.monotributo,
  mb.reintegro_internet,
  mb.reintegro_extraordinario,
  mb.plus_vacacional,
  mb.total_a_facturar,
  ps.pdf_storage_path,
  ps.pdf_filename,
  ps.pdf_uploaded_at
FROM public.payroll_employee_settlements s
JOIN public.payroll_periods p ON p.id = s.period_id
JOIN public.employees e ON e.id = s.employee_id
LEFT JOIN public.payroll_monotributo_breakdown mb ON mb.settlement_id = s.id
LEFT JOIN public.payroll_payslips ps ON ps.settlement_id = s.id;
