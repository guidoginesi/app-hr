-- Migration: el disponible de vacaciones y Días Pow descuenta lo ya pedido para el año siguiente
--
-- Los saldos se guardan por año calendario y un pedido descuenta de la fila
-- del año en que empieza. Unas vacaciones de enero pedidas en octubre quedan
-- en la fila del año siguiente, que todavía no tiene créditos (el traspaso de
-- año los pasa recién el 1/1), y las pantallas, que muestran la fila del año
-- en curso, no las restaban: se veían más días de los que se podían pedir.
--
-- Desde ahora, en vacation y pow_days, available_days resta lo que la fila del
-- año siguiente consumió por encima de sus propios créditos: es la misma
-- cuenta que hace el POST de solicitudes al validar (disponibleParaPedido en
-- src/lib/saldoEntreAnios.ts). Después del traspaso esa fila ya no queda en
-- negativo y la resta vuelve a 0 sola.
--
-- reserved_next_year (nueva, al final) es lo que se restó, para poder decirlo
-- en pantalla. Las filas de la tabla no cambian.
--
-- CREATE OR REPLACE conserva los permisos; las opciones de la vista se
-- reemplazan, por eso security_invoker va explícito.

CREATE OR REPLACE VIEW public.leave_balances_with_details
WITH (security_invoker = true) AS
SELECT
  lb.id,
  lb.employee_id,
  lb.leave_type_id,
  lb.year,
  lb.entitled_days,
  lb.used_days,
  lb.pending_days,
  lb.carried_over,
  lb.bonus_days,
  lb.created_at,
  lb.updated_at,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.is_accumulative,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.hire_date,
  e.is_studying,
  (lb.entitled_days + lb.carried_over + COALESCE(lb.bonus_days, 0) - lb.used_days - lb.pending_days)
    - siguiente.reservado AS available_days,
  siguiente.reservado AS reserved_next_year
FROM public.leave_balances lb
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
JOIN public.employees e ON lb.employee_id = e.id
LEFT JOIN public.leave_balances nb
  ON lt.code IN ('vacation', 'pow_days')
  AND nb.employee_id = lb.employee_id
  AND nb.leave_type_id = lb.leave_type_id
  AND nb.year = lb.year + 1
CROSS JOIN LATERAL (
  SELECT GREATEST(
    0::numeric,
    -COALESCE(nb.entitled_days + nb.carried_over + COALESCE(nb.bonus_days, 0) - nb.used_days - nb.pending_days, 0)
  ) AS reservado
) siguiente;

COMMENT ON VIEW public.leave_balances_with_details IS
  'Vista de balances con detalles. available_days = entitled + carried_over + bonus - used - pending; en vacation y pow_days, menos reserved_next_year (lo que la fila del año siguiente ya consumió por encima de sus créditos).';
