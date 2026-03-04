-- ============================================================
-- Eliminar usuarios de prueba: Líder y Persona/Empleado
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- PASO 1: Verificar qué usuarios van a ser eliminados antes de borrar
SELECT 
  e.id,
  e.first_name,
  e.last_name,
  e.status,
  e.user_id,
  STRING_AGG(ur.role::text, ', ') AS roles
FROM public.employees e
LEFT JOIN public.user_roles ur ON ur.user_id = e.user_id
WHERE
  LOWER(e.first_name) LIKE '%lider%'
  OR LOWER(e.last_name) LIKE '%lider%'
  OR LOWER(e.first_name) LIKE '%líder%'
  OR LOWER(e.last_name) LIKE '%líder%'
  OR LOWER(e.first_name) LIKE '%persona%'
  OR LOWER(e.last_name) LIKE '%persona%'
  OR LOWER(e.first_name) LIKE '%prueba%'
  OR LOWER(e.last_name) LIKE '%prueba%'
  OR LOWER(e.first_name) LIKE '%test%'
  OR LOWER(e.last_name) LIKE '%test%'
GROUP BY e.id, e.first_name, e.last_name, e.status, e.user_id
ORDER BY e.first_name, e.last_name;

-- ============================================================
-- PASO 2: Borrado seguro
-- Revisá los resultados de arriba antes de ejecutar esto.
-- ============================================================

DO $$
DECLARE
  v_employee_ids UUID[];
  v_user_ids     UUID[];
  v_count        INTEGER;
BEGIN
  -- Obtener IDs de empleados de prueba
  SELECT ARRAY_AGG(id), ARRAY_AGG(user_id) FILTER (WHERE user_id IS NOT NULL)
  INTO v_employee_ids, v_user_ids
  FROM public.employees
  WHERE
    LOWER(first_name) LIKE '%lider%'
    OR LOWER(last_name) LIKE '%lider%'
    OR LOWER(first_name) LIKE '%líder%'
    OR LOWER(last_name) LIKE '%líder%'
    OR LOWER(first_name) LIKE '%persona%'
    OR LOWER(last_name) LIKE '%persona%'
    OR LOWER(first_name) LIKE '%prueba%'
    OR LOWER(last_name) LIKE '%prueba%'
    OR LOWER(first_name) LIKE '%test%'
    OR LOWER(last_name) LIKE '%test%';

  IF v_employee_ids IS NULL OR array_length(v_employee_ids, 1) IS NULL THEN
    RAISE NOTICE 'No se encontraron empleados de prueba para eliminar.';
    RETURN;
  END IF;

  RAISE NOTICE 'Empleados encontrados para eliminar: %', array_length(v_employee_ids, 1);

  -- Desasignar como manager de otros empleados
  UPDATE public.employees SET manager_id = NULL
  WHERE manager_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Empleados actualizados (manager_id → NULL): %', v_count;

  -- Borrar notificaciones in-app (message_recipients)
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM public.message_recipients WHERE user_id = ANY(v_user_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Message recipients eliminados: %', v_count;
  END IF;

  -- Borrar leave requests y balances
  DELETE FROM public.leave_requests WHERE employee_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Leave requests eliminadas: %', v_count;

  DELETE FROM public.leave_balances WHERE employee_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Leave balances eliminados: %', v_count;

  -- Borrar evaluaciones
  DELETE FROM public.evaluations WHERE employee_id = ANY(v_employee_ids);
  DELETE FROM public.evaluations WHERE evaluator_id = ANY(v_employee_ids);

  -- Borrar objetivos
  DELETE FROM public.objectives WHERE employee_id = ANY(v_employee_ids);

  -- Borrar user_roles
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = ANY(v_user_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'User roles eliminados: %', v_count;
  END IF;

  -- Borrar empleados
  DELETE FROM public.employees WHERE id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Empleados eliminados: %', v_count;

  RAISE NOTICE '✓ Limpieza completada.';
END $$;

-- PASO 3: Verificación final — no debería devolver resultados
SELECT id, first_name, last_name
FROM public.employees
WHERE
  LOWER(first_name) LIKE '%lider%' OR LOWER(last_name) LIKE '%lider%'
  OR LOWER(first_name) LIKE '%líder%' OR LOWER(last_name) LIKE '%líder%'
  OR LOWER(first_name) LIKE '%persona%' OR LOWER(last_name) LIKE '%persona%'
  OR LOWER(first_name) LIKE '%prueba%' OR LOWER(last_name) LIKE '%prueba%'
  OR LOWER(first_name) LIKE '%test%' OR LOWER(last_name) LIKE '%test%';
