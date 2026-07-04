-- Eliminar todos los períodos SAC 1 y datos asociados (liquidaciones, breakdowns, recibos, facturas).
-- CASCADE: payroll_periods → settlements → monotributo_breakdown / payslips / invoices

-- PASO 1: Verificar qué se va a eliminar
SELECT
  pp.id,
  pp.year,
  pp.month,
  pp.period_key,
  pp.status,
  COUNT(pes.id) AS settlements
FROM public.payroll_periods pp
LEFT JOIN public.payroll_employee_settlements pes ON pes.period_id = pp.id
WHERE pp.period_type = 'SAC_1'
GROUP BY pp.id, pp.year, pp.month, pp.period_key, pp.status
ORDER BY pp.year, pp.month;

-- PASO 2: Eliminar períodos SAC 1 (liquidaciones y adjuntos en cascada)
DELETE FROM public.payroll_periods
WHERE period_type = 'SAC_1';

-- PASO 3: Impedir crear SAC 1 a nivel de base de datos
ALTER TABLE public.payroll_periods
  DROP CONSTRAINT IF EXISTS payroll_periods_period_type_check;

ALTER TABLE public.payroll_periods
  ADD CONSTRAINT payroll_periods_period_type_check
  CHECK (period_type IN ('MONTHLY', 'SAC_2'));

COMMENT ON COLUMN public.payroll_periods.period_type IS
  'MONTHLY = liquidación mensual, SAC_2 = aguinaldo 2do semestre (Dic)';

-- PASO 4: Confirmar
SELECT COUNT(*) AS sac1_restantes FROM public.payroll_periods WHERE period_type = 'SAC_1';
