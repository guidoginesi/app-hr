-- ============================================================
-- MIGRATION: Nuevas columnas en liquidaciones Monotributo
-- Bonificación Anual, Aguinaldo, Adelanto de Sueldo
-- ============================================================

-- Agregar columnas a payroll_monotributo_breakdown
ALTER TABLE public.payroll_monotributo_breakdown
  ADD COLUMN IF NOT EXISTS bonificacion_anual   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aguinaldo             numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adelanto_sueldo       numeric(12,2) NOT NULL DEFAULT 0;

-- Recrear la vista payroll_settlements_with_details para incluir las nuevas columnas
CREATE OR REPLACE VIEW public.payroll_settlements_with_details AS
SELECT
  s.*,
  p.year AS period_year,
  p.month AS period_month,
  p.period_key,
  p.status AS period_status,
  e.user_id AS employee_user_id,
  e.first_name,
  e.last_name,
  COALESCE(e.work_email, e.personal_email) AS employee_email,
  e.employment_type AS current_employment_type,
  mb.sueldo,
  mb.monotributo,
  mb.reintegro_internet,
  mb.reintegro_extraordinario,
  mb.plus_vacacional,
  mb.bonificacion_anual,
  mb.aguinaldo,
  mb.adelanto_sueldo,
  mb.total_a_facturar,
  ps.pdf_storage_path,
  ps.pdf_filename,
  ps.pdf_uploaded_at,
  inv.pdf_storage_path AS invoice_storage_path,
  inv.pdf_filename     AS invoice_filename,
  inv.uploaded_at      AS invoice_uploaded_at
FROM public.payroll_employee_settlements s
JOIN public.payroll_periods p ON p.id = s.period_id
JOIN public.employees e ON e.id = s.employee_id
LEFT JOIN public.payroll_monotributo_breakdown mb ON mb.settlement_id = s.id
LEFT JOIN public.payroll_payslips ps ON ps.settlement_id = s.id
LEFT JOIN public.payroll_invoices inv ON inv.settlement_id = s.id;
