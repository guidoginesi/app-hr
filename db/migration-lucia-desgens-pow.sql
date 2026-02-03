-- Migration: Agregar 2 días Pow a Lucía Desgens
-- Busca el empleado de varias formas y crea el balance si no existe

DO $$
DECLARE
  v_pow_type_id UUID;
  v_employee_id UUID;
  v_balance_id UUID;
  v_year INT := 2026;
BEGIN
  -- Obtener ID del tipo de licencia POW
  SELECT id INTO v_pow_type_id FROM public.leave_types WHERE code = 'pow_days';

  IF v_pow_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia pow_days';
  END IF;

  -- Buscar a Lucía Desgens de varias formas
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(first_name) LIKE '%lucia%' AND LOWER(last_name) LIKE '%desgens%'
  LIMIT 1;

  -- Si no la encontró, intentar otra búsqueda
  IF v_employee_id IS NULL THEN
    SELECT id INTO v_employee_id FROM public.employees 
    WHERE LOWER(first_name) = 'lucía' OR LOWER(first_name) = 'lucia'
    LIMIT 1;
  END IF;

  IF v_employee_id IS NULL THEN
    -- Mostrar todos los empleados que contengan "lucia" para debug
    RAISE NOTICE 'NO ENCONTRADA: Lucía Desgens';
    RAISE NOTICE 'Buscando empleados con "lucia" en el nombre...';
    FOR v_employee_id IN 
      SELECT id FROM public.employees WHERE LOWER(first_name) LIKE '%lucia%' OR LOWER(last_name) LIKE '%lucia%'
    LOOP
      RAISE NOTICE 'Encontrado ID: %', v_employee_id;
    END LOOP;
    RETURN;
  END IF;

  RAISE NOTICE 'Empleado encontrado con ID: %', v_employee_id;

  -- Verificar si existe el balance
  SELECT id INTO v_balance_id FROM public.leave_balances
  WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;

  IF v_balance_id IS NULL THEN
    -- Crear el balance si no existe
    RAISE NOTICE 'Balance no existe, creándolo...';
    INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled_days, used_days, pending_days, carried_over, bonus_days)
    VALUES (v_employee_id, v_pow_type_id, v_year, 0, 0, 0, 0, 2);
    RAISE NOTICE 'Balance creado con 2 días Pow bonus';
  ELSE
    -- Actualizar el balance existente
    UPDATE public.leave_balances 
    SET bonus_days = COALESCE(bonus_days, 0) + 2,
        updated_at = now()
    WHERE id = v_balance_id;
    RAISE NOTICE 'Balance actualizado: +2 días Pow bonus';
  END IF;

  RAISE NOTICE 'Ajuste completado para Lucía Desgens';
END $$;

-- Verificación después de ejecutar:
SELECT e.first_name, e.last_name, lb.bonus_days, lb.entitled_days, lb.used_days, lb.year
FROM leave_balances lb
JOIN employees e ON lb.employee_id = e.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE lt.code = 'pow_days' AND lb.year = 2026
AND (LOWER(e.first_name) LIKE '%lucia%' OR LOWER(e.last_name) LIKE '%desgens%');
