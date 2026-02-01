-- Migration: Corregir vista para incluir bonus_days en el cálculo de días disponibles
-- El campo bonus_days no estaba siendo sumado a available_days

-- Actualizar la vista leave_balances_with_details
CREATE OR REPLACE VIEW public.leave_balances_with_details AS
SELECT 
  lb.*,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.is_accumulative,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.hire_date,
  e.is_studying,
  -- Calculated available days (ahora incluye bonus_days)
  (lb.entitled_days + lb.carried_over + COALESCE(lb.bonus_days, 0) - lb.used_days - lb.pending_days) AS available_days
FROM public.leave_balances lb
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
JOIN public.employees e ON lb.employee_id = e.id;

-- Comentario explicativo
COMMENT ON VIEW public.leave_balances_with_details IS 
  'Vista de balances con detalles. available_days = entitled + carried_over + bonus - used - pending';
