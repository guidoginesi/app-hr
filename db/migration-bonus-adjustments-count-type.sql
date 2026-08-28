-- La vista de ajustes no exponía count_type, así que la pantalla mostraba un
-- número sin unidad. Con Trabajo Remoto en juego eso deja de ser cosmético: un
-- "+2" que en realidad son dos semanas se lee como dos días.
--
-- La columna va al final de la lista porque CREATE OR REPLACE VIEW no deja
-- insertar una columna en el medio (42P16: cannot change name of view column).
CREATE OR REPLACE VIEW public.bonus_adjustments_with_details
WITH (security_invoker = true)
AS
SELECT
  ba.id,
  ba.employee_id,
  ba.leave_type_id,
  ba.year,
  ba.days,
  ba.reason,
  ba.status,
  ba.created_by,
  ba.cancelled_by,
  ba.cancelled_at,
  ba.cancellation_reason,
  ba.created_at,
  ba.updated_at,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  CONCAT(cb.first_name, ' ', cb.last_name) AS created_by_name,
  CONCAT(canc.first_name, ' ', canc.last_name) AS cancelled_by_name,
  lt.count_type
FROM public.bonus_adjustments ba
JOIN public.employees e ON ba.employee_id = e.id
JOIN public.leave_types lt ON ba.leave_type_id = lt.id
LEFT JOIN public.employees cb ON ba.created_by = cb.id
LEFT JOIN public.employees canc ON ba.cancelled_by = canc.id;
