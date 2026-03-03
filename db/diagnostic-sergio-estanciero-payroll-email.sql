-- Diagnóstico: envío de liquidación Febrero 2026 para Sergio Estanciero

SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  e.work_email,
  e.personal_email,
  pes.email_to,           -- email usado al momento de crear el período
  pes.email_provider_id,  -- Resend ID (actualmente no se persiste — debería ser NULL)
  pes.contract_type_snapshot,
  pes.status,
  pes.sent_at,
  pes.sent_by
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
WHERE pp.period_key = '2026-02'
  AND LOWER(e.first_name) LIKE '%sergio%'
  AND LOWER(e.last_name) LIKE '%estanciero%';
