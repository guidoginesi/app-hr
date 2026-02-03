-- Migration: Ajuste de balances de empleados - Febrero 2026
-- Basado en CSV con diferencias de vacaciones, días POW y semanas remotas
-- Los valores negativos se restan del balance, los positivos se suman
-- Ejecutar UNA SOLA VEZ

DO $$
DECLARE
  v_vacation_type_id UUID;
  v_pow_type_id UUID;
  v_remote_type_id UUID;
  v_employee_id UUID;
  v_year INT := 2026; -- Año actual
BEGIN
  -- Obtener IDs de tipos de licencia
  SELECT id INTO v_vacation_type_id FROM public.leave_types WHERE code = 'vacation';
  SELECT id INTO v_pow_type_id FROM public.leave_types WHERE code = 'pow_days';
  SELECT id INTO v_remote_type_id FROM public.leave_types WHERE code = 'remote_work';

  IF v_vacation_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia vacation';
  END IF;
  IF v_pow_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia pow_days';
  END IF;
  IF v_remote_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia remote_work';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Iniciando ajuste de balances - Febrero 2026';
  RAISE NOTICE '==========================================';

  -- ==========================================
  -- Agustina Falvino: Vacaciones=-7, Pow=0, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'agustina' AND LOWER(TRIM(last_name)) = 'falvino' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Agustina Falvino: -7 Vacaciones, -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Agustina Falvino';
  END IF;

  -- ==========================================
  -- Agustina Martinez Marques: Vacaciones=0, Pow=-2, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'agustina' AND LOWER(TRIM(last_name)) LIKE 'martinez%' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Agustina Martinez Marques: -2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Agustina Martinez Marques';
  END IF;

  -- ==========================================
  -- Alicia Prats: Vacaciones=0, Pow=-4, Remotas=-2
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'alicia' AND LOWER(TRIM(last_name)) = 'prats' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Alicia Prats: -4 Pow, -2 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Alicia Prats';
  END IF;

  -- ==========================================
  -- Andrea Soteldo: Vacaciones=-7, Pow=0, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'andrea' AND LOWER(TRIM(last_name)) = 'soteldo' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Andrea Soteldo: -7 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Andrea Soteldo';
  END IF;

  -- ==========================================
  -- Andrés Acerenza: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Andrés Jaromezuk: Vacaciones=0, Pow=-4, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) LIKE 'andr%s' AND LOWER(TRIM(last_name)) = 'jaromezuk' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Andrés Jaromezuk: -4 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Andrés Jaromezuk';
  END IF;

  -- ==========================================
  -- Antonella Medone: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Benjamín Kunkel: Vacaciones=+45, Pow=+19, Remotas=0
  -- ==========================================
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

  -- ==========================================
  -- Brenda Melink: Vacaciones=0, Pow=0, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'brenda' AND LOWER(TRIM(last_name)) = 'melink' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Brenda Melink: -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Brenda Melink';
  END IF;

  -- ==========================================
  -- Candela Paratcha: Vacaciones=-7, Pow=0, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'candela' AND LOWER(TRIM(last_name)) = 'paratcha' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Candela Paratcha: -7 Vacaciones, -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Candela Paratcha';
  END IF;

  -- ==========================================
  -- Carlos Caserotto: Vacaciones=-14, Pow=0, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'carlos' AND LOWER(TRIM(last_name)) = 'caserotto' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Carlos Caserotto: -14 Vacaciones, -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Carlos Caserotto';
  END IF;

  -- ==========================================
  -- Corvalán Sergio: Vacaciones=+7, Pow=+5, Remotas=0
  -- ==========================================
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

  -- ==========================================
  -- Dafne Zas: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Delfina Felice: Vacaciones=-7, Pow=0, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'delfina' AND LOWER(TRIM(last_name)) = 'felice' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Delfina Felice: -7 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Delfina Felice';
  END IF;

  -- ==========================================
  -- Emiliano Gioia: Vacaciones=0, Pow=-2, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'emiliano' AND LOWER(TRIM(last_name)) = 'gioia' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Emiliano Gioia: -2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Emiliano Gioia';
  END IF;

  -- ==========================================
  -- Eric Hoare: Vacaciones=0, Pow=0, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'eric' AND LOWER(TRIM(last_name)) = 'hoare' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Eric Hoare: -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Eric Hoare';
  END IF;

  -- ==========================================
  -- Fernanda Pezzuti: Vacaciones=-7, Pow=+14, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'fernanda' AND LOWER(TRIM(last_name)) = 'pezzuti' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Fernanda Pezzuti: -7 Vacaciones, +14 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Fernanda Pezzuti';
  END IF;

  -- ==========================================
  -- Florencia Virdó: Vacaciones=+12, Pow=+4, Remotas=0
  -- ==========================================
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

  -- ==========================================
  -- Franco Panaro: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Giovanna Maratta: Vacaciones=-14, Pow=-3, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'giovanna' AND LOWER(TRIM(last_name)) = 'maratta' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Giovanna Maratta: -14 Vacaciones, -3 Pow, -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Giovanna Maratta';
  END IF;

  -- ==========================================
  -- Ivan Sosa: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Karen Aranda: Vacaciones=-14, Pow=+5, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'karen' AND LOWER(TRIM(last_name)) = 'aranda' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Karen Aranda: -14 Vacaciones, +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Karen Aranda';
  END IF;

  -- ==========================================
  -- Lucia Desgens: Vacaciones=0, Pow=+2, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'lucia' AND LOWER(TRIM(last_name)) = 'desgens' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Lucia Desgens: +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Lucia Desgens';
  END IF;

  -- ==========================================
  -- Luciana Medina: Vacaciones=0, Pow=0, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'luciana' AND LOWER(TRIM(last_name)) = 'medina' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Luciana Medina: -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Luciana Medina';
  END IF;

  -- ==========================================
  -- Manuel Alvarez: Vacaciones=0, Pow=0, Remotas=-4
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'manuel' AND LOWER(TRIM(last_name)) = 'alvarez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Manuel Alvarez: -4 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Manuel Alvarez';
  END IF;

  -- ==========================================
  -- Manuela Heine: Vacaciones=+15, Pow=0, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'manuela' AND LOWER(TRIM(last_name)) = 'heine' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 15
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Manuela Heine: +15 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Manuela Heine';
  END IF;

  -- ==========================================
  -- Martín Becerra: Vacaciones=+3, Pow=+2, Remotas=0
  -- ==========================================
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

  -- ==========================================
  -- Micaela Morghen: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Nahiara Alvez: Vacaciones=0, Pow=0, Remotas=0 (sin cambios)
  -- ==========================================

  -- ==========================================
  -- Natalia Cabezas: Vacaciones=0, Pow=0, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'natalia' AND LOWER(TRIM(last_name)) = 'cabezas' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Natalia Cabezas: -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Natalia Cabezas';
  END IF;

  -- ==========================================
  -- Ornella Lacelli: Vacaciones=0, Pow=+1, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'ornella' AND LOWER(TRIM(last_name)) = 'lacelli' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Ornella Lacelli: +1 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Ornella Lacelli';
  END IF;

  -- ==========================================
  -- Paula Perez: Vacaciones=+14, Pow=+7, Remotas=0
  -- ==========================================
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

  -- ==========================================
  -- Rodrigo Plutino: Vacaciones=0, Pow=-4, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'rodrigo' AND LOWER(TRIM(last_name)) = 'plutino' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Rodrigo Plutino: -4 Pow, -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Rodrigo Plutino';
  END IF;

  -- ==========================================
  -- Rosario Otero: Vacaciones=+2, Pow=-1, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'rosario' AND LOWER(TRIM(last_name)) = 'otero' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Rosario Otero: +2 Vacaciones, -1 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Rosario Otero';
  END IF;

  -- ==========================================
  -- Ruben Mavarez: Vacaciones=-14, Pow=0, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'ruben' AND LOWER(TRIM(last_name)) = 'mavarez' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Ruben Mavarez: -14 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Ruben Mavarez';
  END IF;

  -- ==========================================
  -- Valeria Crespo: Vacaciones=-7, Pow=0, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'valeria' AND LOWER(TRIM(last_name)) = 'crespo' LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Valeria Crespo: -7 Vacaciones, -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Valeria Crespo';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Migración completada. Revisar mensajes anteriores para empleados no encontrados.';
  RAISE NOTICE '==========================================';

END $$;

-- ==========================================
-- Verificación post-migración
-- ==========================================
-- Ejecutar esta consulta después de la migración para verificar los cambios:
/*
SELECT 
  e.first_name,
  e.last_name,
  lt.code as tipo,
  lt.name as tipo_nombre,
  lb.carried_over,
  lb.bonus_days,
  lb.entitled_days,
  lb.used_days,
  lb.pending_days,
  (lb.entitled_days + lb.carried_over + COALESCE(lb.bonus_days, 0) - lb.used_days - lb.pending_days) AS disponibles
FROM public.leave_balances lb
JOIN public.employees e ON lb.employee_id = e.id
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.year = 2026
ORDER BY e.last_name, e.first_name, lt.code;
*/
