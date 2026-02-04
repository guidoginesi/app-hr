-- Migration: Borrar empleados de prueba
-- Run this in the Supabase SQL Editor
-- Date: 2026-02-04

-- Lista de empleados de prueba a eliminar:
-- 1. Usuario de Prueba Pow
-- 2. Usuario Prueba 2
-- 3. Guido Ginesi
-- 4. Usuario de Prueba 333
-- 5. RRHH Pow

-- Primero verificamos los empleados que vamos a borrar
SELECT id, first_name, last_name, job_title
FROM public.employees
WHERE 
  (LOWER(first_name) LIKE '%usuario%' AND LOWER(last_name) LIKE '%prueba%')
  OR (LOWER(first_name) = 'usuario' AND LOWER(last_name) LIKE '%prueba%')
  OR (LOWER(first_name) = 'guido' AND LOWER(last_name) = 'ginesi')
  OR (LOWER(first_name) = 'rrhh' AND LOWER(last_name) = 'pow')
  OR (first_name = 'Usuario de Prueba' AND last_name = 'Pow')
  OR (first_name = 'Usuario' AND last_name = 'Prueba 2')
  OR (first_name = 'Usuario de Prueba' AND last_name = '333')
ORDER BY first_name, last_name;

-- Borrar los empleados de prueba
-- Las foreign keys con ON DELETE CASCADE se encargarán de borrar los registros relacionados
DO $$
DECLARE
  v_employee_ids UUID[];
  v_count INTEGER;
BEGIN
  -- Obtener los IDs de los empleados de prueba
  SELECT ARRAY_AGG(id) INTO v_employee_ids
  FROM public.employees
  WHERE 
    (LOWER(first_name) LIKE '%usuario%' AND LOWER(last_name) LIKE '%prueba%')
    OR (LOWER(first_name) = 'usuario' AND LOWER(last_name) LIKE '%prueba%')
    OR (LOWER(first_name) = 'guido' AND LOWER(last_name) = 'ginesi')
    OR (LOWER(first_name) = 'rrhh' AND LOWER(last_name) = 'pow')
    OR (first_name = 'Usuario de Prueba' AND last_name = 'Pow')
    OR (first_name = 'Usuario' AND last_name = 'Prueba 2')
    OR (first_name = 'Usuario de Prueba' AND last_name = '333');
  
  IF v_employee_ids IS NULL OR array_length(v_employee_ids, 1) IS NULL THEN
    RAISE NOTICE 'No se encontraron empleados de prueba para eliminar';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Empleados a eliminar: %', array_length(v_employee_ids, 1);
  
  -- Actualizar manager_id a NULL donde estos empleados sean managers
  UPDATE public.employees
  SET manager_id = NULL
  WHERE manager_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Empleados actualizados (manager_id = NULL): %', v_count;
  
  -- Borrar evaluaciones relacionadas (las respuestas se borran por CASCADE)
  DELETE FROM public.evaluations WHERE employee_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Evaluaciones eliminadas: %', v_count;
  
  DELETE FROM public.evaluations WHERE evaluator_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Evaluaciones como evaluador eliminadas: %', v_count;
  
  -- Borrar objetivos
  DELETE FROM public.objectives WHERE employee_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Objetivos eliminados: %', v_count;
  
  -- Borrar time off (si las tablas existen)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_off_requests') THEN
    DELETE FROM public.time_off_requests WHERE employee_id = ANY(v_employee_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Time off requests eliminadas: %', v_count;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'time_off_balances') THEN
    DELETE FROM public.time_off_balances WHERE employee_id = ANY(v_employee_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Time off balances eliminados: %', v_count;
  END IF;
  
  -- Borrar seniority history
  DELETE FROM public.seniority_history WHERE employee_id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Seniority history eliminados: %', v_count;
  
  -- Borrar user_roles
  DELETE FROM public.user_roles WHERE user_id IN (
    SELECT user_id FROM public.employees WHERE id = ANY(v_employee_ids) AND user_id IS NOT NULL
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'User roles eliminados: %', v_count;
  
  -- Finalmente borrar los empleados
  DELETE FROM public.employees WHERE id = ANY(v_employee_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Empleados eliminados: %', v_count;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Empleados de prueba eliminados exitosamente';
END $$;

-- Verificación final - no deberían aparecer resultados
SELECT id, first_name, last_name, job_title
FROM public.employees
WHERE 
  (LOWER(first_name) LIKE '%usuario%' AND LOWER(last_name) LIKE '%prueba%')
  OR (LOWER(first_name) = 'usuario' AND LOWER(last_name) LIKE '%prueba%')
  OR (LOWER(first_name) = 'guido' AND LOWER(last_name) = 'ginesi')
  OR (LOWER(first_name) = 'rrhh' AND LOWER(last_name) = 'pow');
