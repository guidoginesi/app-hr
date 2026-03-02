-- Eliminar período de prueba Abril 2026 y sus liquidaciones (CASCADE)
DELETE FROM public.payroll_periods WHERE period_key = '2026-04';
