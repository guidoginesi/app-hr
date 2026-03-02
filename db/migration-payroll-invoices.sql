-- ============================================================
-- MIGRATION: Facturas de empleados Monotributo
-- ============================================================

-- 1) Tabla de facturas (1:1 con settlement MONOTRIBUTO)
CREATE TABLE IF NOT EXISTS public.payroll_invoices (
  settlement_id     uuid PRIMARY KEY REFERENCES public.payroll_employee_settlements(id) ON DELETE CASCADE,
  pdf_storage_path  text,
  pdf_filename      text,
  uploaded_at       timestamptz,
  uploaded_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2) Crear registro vacío para todos los settlements MONOTRIBUTO existentes que no tengan factura
INSERT INTO public.payroll_invoices (settlement_id)
SELECT s.id
FROM public.payroll_employee_settlements s
WHERE s.contract_type_snapshot = 'MONOTRIBUTO'
  AND NOT EXISTS (
    SELECT 1 FROM public.payroll_invoices i WHERE i.settlement_id = s.id
  );

-- 3) Recrear la vista para incluir datos de factura
CREATE OR REPLACE VIEW public.payroll_settlements_with_details AS
SELECT
  s.*,
  p.year                                          AS period_year,
  p.month                                         AS period_month,
  p.period_key,
  p.status                                        AS period_status,
  e.first_name,
  e.last_name,
  COALESCE(e.work_email, e.personal_email)        AS employee_email,
  e.employment_type                               AS current_employment_type,
  mb.sueldo,
  mb.monotributo,
  mb.reintegro_internet,
  mb.reintegro_extraordinario,
  mb.plus_vacacional,
  mb.total_a_facturar,
  ps.pdf_storage_path,
  ps.pdf_filename,
  ps.pdf_uploaded_at,
  inv.pdf_storage_path                            AS invoice_storage_path,
  inv.pdf_filename                                AS invoice_filename,
  inv.uploaded_at                                 AS invoice_uploaded_at,
  inv.uploaded_by                                 AS invoice_uploaded_by
FROM public.payroll_employee_settlements s
JOIN  public.payroll_periods p              ON p.id   = s.period_id
JOIN  public.employees e                   ON e.id   = s.employee_id
LEFT JOIN public.payroll_monotributo_breakdown mb ON mb.settlement_id = s.id
LEFT JOIN public.payroll_payslips ps        ON ps.settlement_id = s.id
LEFT JOIN public.payroll_invoices inv       ON inv.settlement_id = s.id;
