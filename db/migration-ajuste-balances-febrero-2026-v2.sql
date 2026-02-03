-- Migration: Ajuste de balances de empleados - Febrero 2026 (v2)
-- Basado en CSV con diferencias de vacaciones, días POW y semanas remotas
-- Los valores negativos se restan del balance, los positivos se suman
-- Ejecutar UNA SOLA VEZ

DO $$
DECLARE
  v_vacation_type_id UUID;
  v_pow_type_id UUID;
  v_remote_type_id UUID;
  v_employee_id UUID;
  v_year INT := 2026;
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
  RAISE NOTICE 'Iniciando ajuste de balances - Febrero 2026 (v2)';
  RAISE NOTICE '==========================================';

  -- ==========================================
  -- Benjamin Ariel Bernardo Kunkel: Vacaciones=+45, Pow=+19, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%benjamin%kunkel%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 45
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 19
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Benjamin Ariel Bernardo Kunkel: +45 Vacaciones, +19 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Benjamin Ariel Bernardo Kunkel';
  END IF;

  -- ==========================================
  -- Carlos Federico Caserotto: Vacaciones=-14, Pow=0, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%carlos%caserotto%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Carlos Federico Caserotto: -14 Vacaciones, -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Carlos Federico Caserotto';
  END IF;

  -- ==========================================
  -- Sergio Estanciero Corvalan: Vacaciones=+7, Pow=+5, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%sergio%corvalan%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Sergio Estanciero Corvalan: +7 Vacaciones, +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Sergio Estanciero Corvalan';
  END IF;

  -- ==========================================
  -- Maria Fernanda Pezzutti: Vacaciones=-7, Pow=+14, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%fernanda%pezzutti%'
     OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%maria%pezzutti%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 7
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Maria Fernanda Pezzutti: -7 Vacaciones, +14 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Maria Fernanda Pezzutti';
  END IF;

  -- ==========================================
  -- Florencia Reneé Virdó Lauricella: Vacaciones=+12, Pow=+4, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%florencia%virdo%'
     OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%florencia%lauricella%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 12
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 4
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Florencia Reneé Virdó Lauricella: +12 Vacaciones, +4 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Florencia Reneé Virdó Lauricella';
  END IF;

  -- ==========================================
  -- Giovanna Sol Maratta: Vacaciones=-14, Pow=-3, Remotas=-3
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%giovanna%maratta%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Giovanna Sol Maratta: -14 Vacaciones, -3 Pow, -3 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Giovanna Sol Maratta';
  END IF;

  -- ==========================================
  -- Karen Ayelen Aranda: Vacaciones=-14, Pow=+5, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%karen%aranda%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) - 14
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 5
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Karen Ayelen Aranda: -14 Vacaciones, +5 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Karen Ayelen Aranda';
  END IF;

  -- ==========================================
  -- Lucía Desgens Berenguer: Vacaciones=0, Pow=+2, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%lucia%desgens%'
     OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%lucia%berenguer%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Lucía Desgens Berenguer: +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Lucía Desgens Berenguer';
  END IF;

  -- ==========================================
  -- Manuela Heine Galli: Vacaciones=+15, Pow=0, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%manuela%heine%'
     OR LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%manuela%galli%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 15
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    RAISE NOTICE 'Manuela Heine Galli: +15 Vacaciones';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Manuela Heine Galli';
  END IF;

  -- ==========================================
  -- Martin Eduardo Becerra: Vacaciones=+3, Pow=+2, Remotas=0
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%martin%becerra%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET carried_over = COALESCE(carried_over, 0) + 3
    WHERE employee_id = v_employee_id AND leave_type_id = v_vacation_type_id AND year = v_year;
    UPDATE public.leave_balances SET bonus_days = COALESCE(bonus_days, 0) + 2
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Martin Eduardo Becerra: +3 Vacaciones, +2 Pow';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Martin Eduardo Becerra';
  END IF;

  -- ==========================================
  -- Eric Hoare: Vacaciones=0, Pow=0, Remotas=-1
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%eric%hoare%'
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances SET entitled_days = COALESCE(entitled_days, 0) - 1
    WHERE employee_id = v_employee_id AND leave_type_id = v_remote_type_id AND year = v_year;
    RAISE NOTICE 'Eric Hoare: -1 Remotas';
  ELSE
    RAISE NOTICE 'NO ENCONTRADO: Eric Hoare';
  END IF;

  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Migración completada (11 empleados procesados)';
  RAISE NOTICE '==========================================';

END $$;
