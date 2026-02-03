-- Migration: Restar días Pow bonus a Agustinas
-- Ejecutar UNA SOLA VEZ

DO $$
DECLARE
  v_pow_type_id UUID;
  v_employee_id UUID;
  v_year INT := 2026;
BEGIN
  -- Obtener ID del tipo de licencia POW
  SELECT id INTO v_pow_type_id FROM public.leave_types WHERE code = 'pow_days';

  IF v_pow_type_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el tipo de licencia pow_days';
  END IF;

  -- ==========================================
  -- Agustina Falvino: -2 días Pow bonus
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'agustina' AND LOWER(TRIM(last_name)) = 'falvino' LIMIT 1;
  
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances 
    SET bonus_days = COALESCE(bonus_days, 0) - 2,
        updated_at = now()
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Agustina Falvino: -2 días Pow bonus';
  ELSE
    RAISE NOTICE 'NO ENCONTRADA: Agustina Falvino';
  END IF;

  -- ==========================================
  -- Agustina Martinez Marques: -1 día Pow bonus
  -- ==========================================
  SELECT id INTO v_employee_id FROM public.employees 
  WHERE LOWER(TRIM(first_name)) = 'agustina' AND LOWER(TRIM(last_name)) LIKE 'martinez%' LIMIT 1;
  
  IF v_employee_id IS NOT NULL THEN
    UPDATE public.leave_balances 
    SET bonus_days = COALESCE(bonus_days, 0) - 1,
        updated_at = now()
    WHERE employee_id = v_employee_id AND leave_type_id = v_pow_type_id AND year = v_year;
    RAISE NOTICE 'Agustina Martinez Marques: -1 día Pow bonus';
  ELSE
    RAISE NOTICE 'NO ENCONTRADA: Agustina Martinez Marques';
  END IF;

  RAISE NOTICE 'Ajuste completado';
END $$;

-- Verificación:
-- SELECT e.first_name, e.last_name, lb.bonus_days, lb.entitled_days, lb.used_days
-- FROM leave_balances lb
-- JOIN employees e ON lb.employee_id = e.id
-- JOIN leave_types lt ON lb.leave_type_id = lt.id
-- WHERE lt.code = 'pow_days' AND lb.year = 2026
-- AND (LOWER(e.first_name) = 'agustina');
