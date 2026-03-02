-- ============================================================
-- TEST: Liquidación Monotributo para Guido Daniel Ginesi
-- Crea un período de prueba solo con su settlement listo para enviar
-- ============================================================

DO $$
DECLARE
  v_period_id   uuid;
  v_employee_id uuid;
  v_settlement_id uuid;
BEGIN

  -- Buscar el employee_id de Guido
  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE work_email = 'guido@pow.la'
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el empleado guido@pow.la';
  END IF;

  -- Crear período de prueba con Abril 2026 (si ya existe, lo reutiliza)
  INSERT INTO public.payroll_periods (year, month, period_key, status)
  VALUES (2026, 4, '2026-04', 'IN_REVIEW')
  ON CONFLICT (period_key) DO UPDATE SET status = 'IN_REVIEW'
  RETURNING id INTO v_period_id;

  IF v_period_id IS NULL THEN
    SELECT id INTO v_period_id FROM public.payroll_periods WHERE period_key = '2026-04';
  END IF;

  -- Insertar o actualizar el settlement de Guido como MONOTRIBUTO
  INSERT INTO public.payroll_employee_settlements
    (period_id, employee_id, contract_type_snapshot, currency, status, email_to)
  VALUES
    (v_period_id, v_employee_id, 'MONOTRIBUTO', 'ARS', 'READY_TO_SEND', 'guido@pow.la')
  ON CONFLICT (period_id, employee_id) DO UPDATE
    SET status = 'READY_TO_SEND',
        contract_type_snapshot = 'MONOTRIBUTO',
        email_to = 'guido@pow.la'
  RETURNING id INTO v_settlement_id;

  -- Insertar o actualizar el desglose de monotributo con valores de prueba
  INSERT INTO public.payroll_monotributo_breakdown
    (settlement_id, sueldo, monotributo, reintegro_internet, reintegro_extraordinario, plus_vacacional, total_a_facturar)
  VALUES
    (v_settlement_id, 500000, 25000, 5000, 0, 0, 530000)
  ON CONFLICT (settlement_id) DO UPDATE
    SET sueldo = 500000,
        monotributo = 25000,
        reintegro_internet = 5000,
        reintegro_extraordinario = 0,
        plus_vacacional = 0,
        total_a_facturar = 530000;

  RAISE NOTICE 'Listo! period_id=% settlement_id=%', v_period_id, v_settlement_id;

END $$;

-- Verificar el resultado
SELECT
  pp.period_key,
  pp.status AS period_status,
  e.first_name || ' ' || e.last_name AS empleado,
  pes.contract_type_snapshot AS tipo,
  pes.status AS settlement_status,
  pes.email_to,
  mb.sueldo,
  mb.monotributo,
  mb.reintegro_internet,
  mb.total_a_facturar
FROM public.payroll_periods pp
JOIN public.payroll_employee_settlements pes ON pes.period_id = pp.id
JOIN public.employees e ON e.id = pes.employee_id
LEFT JOIN public.payroll_monotributo_breakdown mb ON mb.settlement_id = pes.id
WHERE pp.period_key = '2026-04';
