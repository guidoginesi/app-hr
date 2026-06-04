-- Trabajo remoto: prorrateo proporcional al ingreso (8 semanas × días restantes del año).
-- Vacaciones y Pow siguen en 0 hasta el 1° de octubre para ingresos 2026.

DO $$
DECLARE
  v_remote_type_id UUID;
  v_year INT := 2026;
  rec RECORD;
  v_days_worked INT;
  v_total_days INT;
  v_weeks INT;
  v_work_start DATE;
BEGIN
  SELECT id INTO v_remote_type_id FROM public.leave_types WHERE code = 'remote_work';
  IF v_remote_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia remote_work';
  END IF;

  v_total_days := CASE
    WHEN (v_year % 4 = 0 AND v_year % 100 <> 0) OR v_year % 400 = 0 THEN 366
    ELSE 365
  END;

  FOR rec IN
    SELECT e.id AS employee_id, e.hire_date
    FROM public.employees e
    WHERE e.status = 'active'
      AND e.hire_date >= DATE '2026-01-01'
      AND e.hire_date <= DATE '2026-12-31'
  LOOP
    v_work_start := GREATEST(rec.hire_date, DATE '2026-01-01');
    v_days_worked := (DATE '2026-12-31' - v_work_start) + 1;
    v_weeks := FLOOR((8.0 * v_days_worked) / v_total_days);

    INSERT INTO public.leave_balances (
      employee_id, leave_type_id, year,
      entitled_days, used_days, pending_days, carried_over, bonus_days
    )
    VALUES (
      rec.employee_id, v_remote_type_id, v_year,
      v_weeks, 0, 0, 0, 0
    )
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET
      entitled_days = EXCLUDED.entitled_days,
      updated_at = now();
  END LOOP;
END $$;
