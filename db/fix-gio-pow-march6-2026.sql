-- Fix: Día Pow de Giovanna Sol Maratta guardado un día antes por bug de timezone
-- La solicitud muestra 5/3/2026 pero debería ser 6/3/2026

-- PASO 1: Verificar la solicitud antes de corregir
SELECT
  lr.id,
  e.first_name || ' ' || e.last_name AS empleado,
  lt.name AS tipo,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
WHERE
  LOWER(e.first_name) LIKE '%giovanna%'
  AND lt.code = 'pow_days'
  AND lr.start_date = '2026-03-05'
ORDER BY lr.created_at DESC;

-- PASO 2: Corregir las fechas (ejecutar solo si el PASO 1 muestra la fila correcta)
UPDATE leave_requests lr
SET
  start_date = '2026-03-06',
  end_date   = '2026-03-06',
  updated_at = now()
WHERE
  lr.employee_id = (
    SELECT id FROM employees
    WHERE LOWER(first_name) LIKE '%giovanna%'
      AND LOWER(last_name) LIKE '%maratta%'
    LIMIT 1
  )
  AND lr.leave_type_id = (
    SELECT id FROM leave_types WHERE code = 'pow_days' LIMIT 1
  )
  AND lr.start_date = '2026-03-05'
  AND lr.end_date   = '2026-03-05';

-- PASO 3: Verificación final
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  lt.name AS tipo,
  lr.start_date,
  lr.end_date,
  lr.status
FROM leave_requests lr
JOIN employees e ON e.id = lr.employee_id
JOIN leave_types lt ON lt.id = lr.leave_type_id
WHERE
  LOWER(e.first_name) LIKE '%giovanna%'
  AND lt.code = 'pow_days'
ORDER BY lr.created_at DESC;
