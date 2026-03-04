-- Fix: Franco Panaro — corregir liquidación Febrero 2026 a Rel. Dependencia
-- Cambia el snapshot, elimina el breakdown de monotributo y crea el registro de payslip.

-- PASO 1: Verificar el estado actual
SELECT
  pes.id AS settlement_id,
  e.first_name || ' ' || e.last_name AS empleado,
  pes.contract_type_snapshot,
  pes.status,
  pmb.total_a_facturar,
  pps.pdf_filename
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_monotributo_breakdown pmb ON pmb.settlement_id = pes.id
LEFT JOIN payroll_payslips pps ON pps.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
  AND LOWER(e.first_name) LIKE '%franco%'
  AND LOWER(e.last_name) LIKE '%panaro%';

-- ============================================================
-- PASO 2: Migrar el settlement (ejecutar solo si el PASO 1 confirma que es MONOTRIBUTO)
-- ============================================================
DO $$
DECLARE
  v_settlement_id UUID;
BEGIN
  SELECT pes.id INTO v_settlement_id
  FROM payroll_periods pp
  JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
  JOIN employees e ON e.id = pes.employee_id
  WHERE pp.period_key = '2026-02'
    AND LOWER(e.first_name) LIKE '%franco%'
    AND LOWER(e.last_name) LIKE '%panaro%'
  LIMIT 1;

  IF v_settlement_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el settlement de Franco Panaro en 2026-02';
  END IF;

  -- 1. Borrar el breakdown de monotributo
  DELETE FROM payroll_monotributo_breakdown WHERE settlement_id = v_settlement_id;
  RAISE NOTICE 'Breakdown de monotributo eliminado';

  -- 2. Cambiar el snapshot a RELACION_DEPENDENCIA y volver a DRAFT
  UPDATE payroll_employee_settlements
  SET
    contract_type_snapshot = 'RELACION_DEPENDENCIA',
    status                 = 'DRAFT',
    sent_at                = NULL,
    sent_by                = NULL,
    updated_at             = now()
  WHERE id = v_settlement_id;
  RAISE NOTICE 'Settlement actualizado a RELACION_DEPENDENCIA y DRAFT';

  -- 3. Crear registro de payslip vacío para que se pueda subir el PDF
  INSERT INTO payroll_payslips (settlement_id)
  VALUES (v_settlement_id)
  ON CONFLICT (settlement_id) DO NOTHING;
  RAISE NOTICE 'Registro de payslip creado';

  RAISE NOTICE '✓ Franco Panaro ahora figura como Rel. Dependencia en Febrero 2026';
END $$;

-- PASO 3: Verificación final
SELECT
  pes.id AS settlement_id,
  e.first_name || ' ' || e.last_name AS empleado,
  pes.contract_type_snapshot,
  pes.status,
  pps.pdf_filename
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_payslips pps ON pps.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
  AND LOWER(e.first_name) LIKE '%franco%'
  AND LOWER(e.last_name) LIKE '%panaro%';
