-- ============================================================
-- Reset liquidación Febrero 2026 — solo MONOTRIBUTISTAS
-- Los recibos de sueldo (relación en dependencia) NO se tocan.
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- PASO 1: Verificar qué se va a resetear antes de hacer cambios
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  pes.contract_type_snapshot,
  pes.status AS estado_actual,
  pes.sent_at,
  pmb.sueldo,
  pmb.total_a_facturar
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_monotributo_breakdown pmb ON pmb.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
  AND pes.contract_type_snapshot = 'MONOTRIBUTO'
ORDER BY e.last_name, e.first_name;

-- ============================================================
-- PASO 2: Reset — ejecutar solo si el PASO 1 se ve correcto
-- ============================================================

DO $$
DECLARE
  v_period_id   UUID;
  v_count       INTEGER;
BEGIN
  -- Obtener el período de febrero 2026
  SELECT id INTO v_period_id
  FROM payroll_periods
  WHERE period_key = '2026-02';

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el período 2026-02';
  END IF;

  RAISE NOTICE 'Período encontrado: %', v_period_id;

  -- 1. Resetear los valores del breakdown de monotributistas a cero
  UPDATE payroll_monotributo_breakdown pmb
  SET
    sueldo                    = 0,
    monotributo               = 0,
    reintegro_internet        = 0,
    reintegro_extraordinario  = 0,
    plus_vacacional           = 0,
    bonificacion_anual        = 0,
    aguinaldo                 = 0,
    adelanto_sueldo           = 0,
    total_a_facturar          = 0,
    updated_at                = now()
  WHERE pmb.settlement_id IN (
    SELECT id FROM payroll_employee_settlements
    WHERE period_id = v_period_id
      AND contract_type_snapshot = 'MONOTRIBUTO'
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Breakdowns reseteados: %', v_count;

  -- 2. Volver los settlements de monotributistas a DRAFT
  UPDATE payroll_employee_settlements
  SET
    status      = 'DRAFT',
    sent_at     = NULL,
    sent_by     = NULL,
    email_to    = NULL,
    updated_at  = now()
  WHERE period_id = v_period_id
    AND contract_type_snapshot = 'MONOTRIBUTO';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Settlements reseteados a DRAFT: %', v_count;

  -- 3. Volver el período a DRAFT para que sea editable
  UPDATE payroll_periods
  SET
    status     = 'DRAFT',
    updated_at = now()
  WHERE id = v_period_id;
  RAISE NOTICE 'Período vuelto a DRAFT.';

  RAISE NOTICE '✓ Reset completado. Los recibos de relación en dependencia no fueron modificados.';
END $$;

-- ============================================================
-- PASO 3: Verificación final
-- ============================================================

-- Monotributistas: deben mostrar status=DRAFT y valores en 0
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  pes.status,
  pmb.sueldo,
  pmb.total_a_facturar
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_monotributo_breakdown pmb ON pmb.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
  AND pes.contract_type_snapshot = 'MONOTRIBUTO'
ORDER BY e.last_name, e.first_name;

-- Relación en dependencia: deben seguir intactos con sus PDFs
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  pes.status,
  pps.pdf_filename,
  pps.pdf_uploaded_at
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_payslips pps ON pps.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
  AND pes.contract_type_snapshot = 'RELACION_DEPENDENCIA'
ORDER BY e.last_name, e.first_name;
