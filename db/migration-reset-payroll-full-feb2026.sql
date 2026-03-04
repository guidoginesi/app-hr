-- ============================================================
-- Reset COMPLETO liquidación Febrero 2026
-- Incluye MONOTRIBUTISTAS y RELACIÓN EN DEPENDENCIA
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- PASO 1: Verificar qué se va a resetear antes de hacer cambios
SELECT
  e.first_name || ' ' || e.last_name AS empleado,
  pes.contract_type_snapshot,
  pes.status AS estado_actual,
  pes.sent_at,
  pmb.total_a_facturar,
  pps.pdf_filename
FROM payroll_periods pp
JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN employees e ON e.id = pes.employee_id
LEFT JOIN payroll_monotributo_breakdown pmb ON pmb.settlement_id = pes.id
LEFT JOIN payroll_payslips pps ON pps.settlement_id = pes.id
WHERE pp.period_key = '2026-02'
ORDER BY pes.contract_type_snapshot, e.last_name, e.first_name;

-- ============================================================
-- PASO 2: Reset completo — ejecutar solo si el PASO 1 se ve correcto
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

  -- 1. Borrar breakdowns de monotributistas
  DELETE FROM payroll_monotributo_breakdown
  WHERE settlement_id IN (
    SELECT id FROM payroll_employee_settlements
    WHERE period_id = v_period_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Breakdowns de monotributo eliminados: %', v_count;

  -- 2. Borrar payslips (recibos de sueldo de relación en dependencia)
  DELETE FROM payroll_payslips
  WHERE settlement_id IN (
    SELECT id FROM payroll_employee_settlements
    WHERE period_id = v_period_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Payslips eliminados: %', v_count;

  -- 3. Borrar facturas (invoices) si la tabla existe
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_invoices'
  ) THEN
    DELETE FROM payroll_invoices
    WHERE settlement_id IN (
      SELECT id FROM payroll_employee_settlements
      WHERE period_id = v_period_id
    );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Invoices eliminados: %', v_count;
  ELSE
    RAISE NOTICE 'Tabla payroll_invoices no existe, se omite.';
  END IF;

  -- 4. Borrar todos los settlements del período
  DELETE FROM payroll_employee_settlements
  WHERE period_id = v_period_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Settlements eliminados: %', v_count;

  -- 5. Volver el período a DRAFT para que sea editable y generable de nuevo
  UPDATE payroll_periods
  SET
    status     = 'DRAFT',
    updated_at = now()
  WHERE id = v_period_id;
  RAISE NOTICE 'Período vuelto a DRAFT.';

  RAISE NOTICE '✓ Reset completo de Febrero 2026 finalizado. Podés volver a generar la liquidación desde el panel.';
END $$;

-- ============================================================
-- PASO 3: Verificación final — debe mostrar el período en DRAFT sin settlements
-- ============================================================

SELECT
  pp.period_key,
  pp.status AS estado_periodo,
  COUNT(pes.id) AS cantidad_settlements
FROM payroll_periods pp
LEFT JOIN payroll_employee_settlements pes ON pes.period_id = pp.id
WHERE pp.period_key = '2026-02'
GROUP BY pp.period_key, pp.status;
