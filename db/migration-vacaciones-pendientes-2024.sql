-- Migration: Agregar vacaciones y días Pow pendientes al 31/12/2024
-- Estos días se suman como carried_over (vacaciones) y bonus_days (pow)
-- Ejecutar UNA SOLA VEZ

-- ==========================================
-- 1. Obtener IDs de tipos de licencia
-- ==========================================
DO $$
DECLARE
  v_vacation_type_id UUID;
  v_pow_type_id UUID;
  v_employee_id UUID;
  v_balance_id UUID;
  v_year INT := 2025; -- Los días se suman al balance 2025
BEGIN
  -- Obtener IDs de tipos de licencia
  SELECT id INTO v_vacation_type_id FROM public.leave_types WHERE code = 'vacation';
  SELECT id INTO v_pow_type_id FROM public.leave_types WHERE code = 'pow_days';

  IF v_vacation_type_id IS NULL OR v_pow_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los tipos de licencia vacation o pow_days';
  END IF;

  -- ==========================================
  -- 2. Actualizar balances por empleado
  -- ==========================================

  -- Franco Panaro: Vacaciones=0, Pow=0 (sin cambios)

  -- Luciana Medina: Vacaciones=0, Pow=0 (sin cambios)

  -- Emiliano Gioia: Vacaciones=0, Pow=0 (sin cambios)

  -- Agustina Martinez Marques: Vacaciones=0, Pow=0 (sin cambios)

  -- Candela Paratcha: Vacaciones=0, Pow=1
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'candela' AND LOWER(TRIM(last_name)) = 'paratcha' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Candela Paratcha: +1 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Candela Paratcha';
  END IF;

  -- Carlos Caserotto: Vacaciones=0, Pow=0 (sin cambios)

  -- Natalia Cabezas: Vacaciones=0, Pow=3
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'natalia' AND LOWER(TRIM(last_name)) = 'cabezas' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Natalia Cabezas: +3 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Natalia Cabezas';
  END IF;

  -- Agustina Falvino: Vacaciones=0, Pow=0 (sin cambios)

  -- Ruben Mavarez: Vacaciones=0, Pow=4
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'ruben' AND LOWER(TRIM(last_name)) = 'mavarez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Ruben Mavarez: +4 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Ruben Mavarez';
  END IF;

  -- Dafne Zas: Vacaciones=0, Pow=0 (sin cambios)

  -- Nahiara Alvez: Vacaciones=7, Pow=2
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'nahiara' AND LOWER(TRIM(last_name)) = 'alvez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Nahiara Alvez: +7 Vacaciones, +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Nahiara Alvez';
  END IF;

  -- Florencia Virdó: Vacaciones=12, Pow=4
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'florencia' AND LOWER(TRIM(last_name)) LIKE 'vird%' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 12
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Florencia Virdó: +12 Vacaciones, +4 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Florencia Virdó';
  END IF;

  -- Andrea Soteldo: Vacaciones=7, Pow=6
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'andrea' AND LOWER(TRIM(last_name)) = 'soteldo' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 6
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Andrea Soteldo: +7 Vacaciones, +6 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Andrea Soteldo';
  END IF;

  -- Lucia Desgens: Vacaciones=0, Pow=2
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'lucia' AND LOWER(TRIM(last_name)) = 'desgens' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Lucia Desgens: +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Lucia Desgens';
  END IF;

  -- Andrés Jaromezuk: Vacaciones=14, Pow=0
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) LIKE 'andr%s' AND LOWER(TRIM(last_name)) = 'jaromezuk' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Andrés Jaromezuk: +14 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Andrés Jaromezuk';
  END IF;

  -- Delfina Felice: Vacaciones=0, Pow=0 (sin cambios)

  -- Micaela Morghen: Vacaciones=14, Pow=6
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'micaela' AND LOWER(TRIM(last_name)) = 'morghen' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 6
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Micaela Morghen: +14 Vacaciones, +6 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Micaela Morghen';
  END IF;

  -- Martín Becerra: Vacaciones=3, Pow=2
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) LIKE 'mart%n' AND LOWER(TRIM(last_name)) = 'becerra' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Martín Becerra: +3 Vacaciones, +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Martín Becerra';
  END IF;

  -- Paula Perez: Vacaciones=14, Pow=7
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'paula' AND LOWER(TRIM(last_name)) = 'perez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Paula Perez: +14 Vacaciones, +7 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Paula Perez';
  END IF;

  -- Rosario Otero: Vacaciones=0, Pow=5
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'rosario' AND LOWER(TRIM(last_name)) = 'otero' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Rosario Otero: +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Rosario Otero';
  END IF;

  -- Giovanna Maratta: Vacaciones=0, Pow=4
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'giovanna' AND LOWER(TRIM(last_name)) = 'maratta' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Giovanna Maratta: +4 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Giovanna Maratta';
  END IF;

  -- Ornella Lacelli: Vacaciones=0, Pow=0 (sin cambios)

  -- Manuel Alvarez: Vacaciones=0, Pow=9
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'manuel' AND LOWER(TRIM(last_name)) = 'alvarez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 9
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Manuel Alvarez: +9 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Manuel Alvarez';
  END IF;

  -- Antonella Medone: Vacaciones=7, Pow=2
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'antonella' AND LOWER(TRIM(last_name)) = 'medone' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Antonella Medone: +7 Vacaciones, +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Antonella Medone';
  END IF;

  -- Karen Aranda: Vacaciones=0, Pow=5
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'karen' AND LOWER(TRIM(last_name)) = 'aranda' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Karen Aranda: +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Karen Aranda';
  END IF;

  -- Alicia Prats: Vacaciones=0, Pow=0 (sin cambios)

  -- Ivan Sosa: Vacaciones=0, Pow=5
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'ivan' AND LOWER(TRIM(last_name)) = 'sosa' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Ivan Sosa: +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Ivan Sosa';
  END IF;

  -- Brenda Melink: Vacaciones=7, Pow=10
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'brenda' AND LOWER(TRIM(last_name)) = 'melink' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 10
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Brenda Melink: +7 Vacaciones, +10 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Brenda Melink';
  END IF;

  -- Eric Hoare: Vacaciones=0, Pow=0 (sin cambios)

  -- Andrés Acerenza: Vacaciones=0, Pow=0 (sin cambios)

  -- Rodrigo Plutino: Vacaciones=14, Pow=0
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'rodrigo' AND LOWER(TRIM(last_name)) = 'plutino' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Rodrigo Plutino: +14 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Rodrigo Plutino';
  END IF;

  -- Manuela Heine: Vacaciones=15, Pow=5
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'manuela' AND LOWER(TRIM(last_name)) = 'heine' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 15
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Manuela Heine: +15 Vacaciones, +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Manuela Heine';
  END IF;

  -- Benjamín Kunkel: Vacaciones=45, Pow=19
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) LIKE 'benjam%n' AND LOWER(TRIM(last_name)) = 'kunkel' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 45
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 19
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Benjamín Kunkel: +45 Vacaciones, +19 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Benjamín Kunkel';
  END IF;

  -- Corvalán Sergio: Vacaciones=7, Pow=5
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'sergio' AND LOWER(TRIM(last_name)) LIKE 'corval%n' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Sergio Corvalán: +7 Vacaciones, +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Sergio Corvalán';
  END IF;

  -- Fernanda Pezzuti: Vacaciones=0, Pow=14
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'fernanda' AND LOWER(TRIM(last_name)) = 'pezzuti' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Fernanda Pezzuti: +14 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Fernanda Pezzuti';
  END IF;

  -- Valeria Crespo: Vacaciones=0, Pow=2
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'valeria' AND LOWER(TRIM(last_name)) = 'crespo' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Valeria Crespo: +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Valeria Crespo';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Migración completada. Revisar mensajes anteriores para empleados no encontrados.';
  RAISE NOTICE '==========================================';

END $$;

-- ==========================================
-- 3. Verificación post-migración
-- ==========================================
-- Ejecutar esta consulta después de la migración para verificar los cambios:
/*
SELECT 
  e.first_name,
  e.last_name,
  lt.name as tipo,
  lb.carried_over,
  lb.bonus_days,
  lb.entitled_days,
  lb.used_days
FROM public.leave_balances lb
JOIN public.employees e ON lb.employee_id = e.id
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.year = 2025
  AND (lb.carried_over > 0 OR lb.bonus_days > 0)
ORDER BY e.last_name, lt.name;
*/
