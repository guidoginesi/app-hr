-- Eliminar períodos SAC 1 y impedir crearlos de nuevo.
-- CASCADE: payroll_periods → settlements → monotributo_breakdown / payslips / invoices

DELETE FROM public.payroll_periods
WHERE period_type = 'SAC_1';

ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_period_type_check;

ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_period_type_check
  CHECK (period_type IN ('MONTHLY', 'SAC_2'));

COMMENT ON COLUMN public.payroll_periods.period_type IS
  'MONTHLY = liquidación mensual, SAC_2 = aguinaldo 2do semestre (Dic)';
