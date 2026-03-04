-- Fix: cargar email_to en el settlement de Sergio Estanciero (Febrero 2026)

-- PASO 1: Ver qué emails tiene Sergio en employees
SELECT id, first_name, last_name, work_email, personal_email
FROM employees
WHERE LOWER(first_name) LIKE '%sergio%'
  AND LOWER(last_name) LIKE '%estanciero%';

-- PASO 2: Actualizar email_to en su settlement de febrero 2026
-- (usa work_email si existe, sino personal_email)
UPDATE payroll_employee_settlements pes
SET
  email_to   = COALESCE(e.work_email, e.personal_email),
  updated_at = now()
FROM employees e
JOIN payroll_periods pp ON pp.id = pes.period_id
WHERE pes.employee_id = e.id
  AND pp.period_key = '2026-02'
  AND LOWER(e.first_name) LIKE '%sergio%'
  AND LOWER(e.last_name) LIKE '%estanciero%';

-- PASO 3: Verificar
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  pes.email_to,
  pes.status
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
WHERE pp.period_key = '2026-02'
  AND LOWER(e.first_name) LIKE '%sergio%'
  AND LOWER(e.last_name) LIKE '%estanciero%';
