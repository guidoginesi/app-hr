-- ============================================================
-- Fix: rellenar email_to en todos los settlements que lo tienen vacío
-- usando el email actual del empleado (work_email > personal_email).
-- ============================================================

-- PASO 1: Ver cuántos settlements tienen email_to vacío y qué empleados son
SELECT
  pp.period_key,
  e.first_name || ' ' || e.last_name AS empleado,
  e.work_email,
  e.personal_email,
  pes.email_to,
  pes.status
FROM payroll_employee_settlements pes
JOIN payroll_periods pp ON pp.id = pes.period_id
JOIN employees e ON e.id = pes.employee_id
WHERE (pes.email_to IS NULL OR TRIM(pes.email_to) = '')
ORDER BY pp.period_key DESC, e.last_name, e.first_name;

-- ============================================================
-- PASO 2: Actualizar con el email actual del empleado
-- ============================================================
UPDATE payroll_employee_settlements pes
SET
  email_to   = TRIM(COALESCE(NULLIF(TRIM(e.work_email), ''), NULLIF(TRIM(e.personal_email), ''))),
  updated_at = now()
FROM employees e
WHERE pes.employee_id = e.id
  AND (pes.email_to IS NULL OR TRIM(pes.email_to) = '')
  AND COALESCE(NULLIF(TRIM(e.work_email), ''), NULLIF(TRIM(e.personal_email), '')) IS NOT NULL;

-- Reportar cuántos quedaron actualizados
DO $$
DECLARE v_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Settlements actualizados: %', v_count;
END $$;

-- PASO 3: Verificar si queda alguno sin email (estos empleados no tienen email cargado)
SELECT
  pp.period_key,
  e.first_name || ' ' || e.last_name AS empleado,
  e.work_email,
  e.personal_email,
  pes.status
FROM payroll_employee_settlements pes
JOIN payroll_periods pp ON pp.id = pes.period_id
JOIN employees e ON e.id = pes.employee_id
WHERE (pes.email_to IS NULL OR TRIM(pes.email_to) = '')
ORDER BY pp.period_key DESC, e.last_name;
