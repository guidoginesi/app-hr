-- Fix: empleados ingresados en 2026 con saldos asignados antes del 1° de octubre
-- Vacaciones, Días Pow y semanas remotas deben quedar en 0 hasta la renovación del 1/oct.

UPDATE public.leave_balances lb
SET
  entitled_days = 0,
  updated_at = now()
FROM public.employees e,
     public.leave_types lt
WHERE lb.employee_id = e.id
  AND lb.leave_type_id = lt.id
  AND lb.year = 2026
  AND lt.code IN ('vacation', 'pow_days', 'remote_work')
  AND e.hire_date >= '2026-01-01'
  AND CURRENT_DATE < DATE '2026-10-01';

-- Verificación: Manuela Touceda, Agustina Barón, Martina Arias
SELECT
  e.first_name,
  e.last_name,
  e.hire_date,
  lt.code AS leave_type,
  lb.entitled_days,
  lb.carried_over,
  lb.used_days,
  lb.pending_days,
  lb.bonus_days
FROM public.employees e
JOIN public.leave_balances lb ON lb.employee_id = e.id AND lb.year = 2026
JOIN public.leave_types lt ON lt.id = lb.leave_type_id
WHERE (
  (LOWER(e.last_name) LIKE '%touceda%' AND LOWER(e.first_name) LIKE '%manuela%')
  OR (LOWER(e.last_name) LIKE '%barón%' OR LOWER(e.last_name) LIKE '%baron%')
     AND LOWER(e.first_name) LIKE '%agustina%'
  OR (LOWER(e.last_name) LIKE '%arias%' AND LOWER(e.first_name) LIKE '%martina%')
)
ORDER BY e.last_name, lt.code;
