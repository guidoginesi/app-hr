-- Migration: Reset evaluaciones de Agustina Martinez Marques
-- Run this in the Supabase SQL Editor
-- Date: 2026-02-04

-- Reiniciar AMBAS evaluaciones: autoevaluación y evaluación de líder
DO $$
DECLARE
  v_employee_id UUID;
  v_self_eval_id UUID;
  v_leader_eval_id UUID;
  v_period_name TEXT;
  v_deleted_count INTEGER;
BEGIN
  -- Buscar el employee_id de Agustina Martinez Marques
  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE LOWER(first_name) LIKE '%agustina%' 
    AND LOWER(last_name) LIKE '%martinez%marques%';
  
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró empleado con nombre Agustina Martinez Marques';
  END IF;
  
  RAISE NOTICE 'Employee ID encontrado: %', v_employee_id;
  
  -- =============================================
  -- AUTOEVALUACIÓN (type = 'self')
  -- =============================================
  SELECT e.id, ep.name INTO v_self_eval_id, v_period_name
  FROM public.evaluations e
  JOIN public.evaluation_periods ep ON e.period_id = ep.id
  WHERE e.employee_id = v_employee_id
    AND e.type = 'self'
    AND ep.is_active = true
  ORDER BY e.created_at DESC
  LIMIT 1;
  
  IF v_self_eval_id IS NOT NULL THEN
    -- Borrar respuestas
    DELETE FROM public.evaluation_responses WHERE evaluation_id = v_self_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Autoevaluación - Respuestas eliminadas: %', v_deleted_count;
    
    -- Borrar preguntas abiertas
    DELETE FROM public.evaluation_open_questions WHERE evaluation_id = v_self_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Autoevaluación - Preguntas abiertas eliminadas: %', v_deleted_count;
    
    -- Resetear la evaluación
    UPDATE public.evaluations
    SET 
      status = 'draft',
      current_step = 0,
      total_score = NULL,
      dimension_scores = NULL,
      submitted_at = NULL,
      updated_at = now()
    WHERE id = v_self_eval_id;
    
    RAISE NOTICE 'Autoevaluación reiniciada: % (Período: %)', v_self_eval_id, v_period_name;
  ELSE
    RAISE NOTICE 'No se encontró autoevaluación activa';
  END IF;
  
  -- =============================================
  -- EVALUACIÓN DE LÍDER (type = 'leader')
  -- =============================================
  SELECT e.id INTO v_leader_eval_id
  FROM public.evaluations e
  JOIN public.evaluation_periods ep ON e.period_id = ep.id
  WHERE e.employee_id = v_employee_id
    AND e.type = 'leader'
    AND ep.is_active = true
  ORDER BY e.created_at DESC
  LIMIT 1;
  
  IF v_leader_eval_id IS NOT NULL THEN
    -- Borrar respuestas
    DELETE FROM public.evaluation_responses WHERE evaluation_id = v_leader_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Eval. Líder - Respuestas eliminadas: %', v_deleted_count;
    
    -- Borrar preguntas abiertas
    DELETE FROM public.evaluation_open_questions WHERE evaluation_id = v_leader_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Eval. Líder - Preguntas abiertas eliminadas: %', v_deleted_count;
    
    -- Borrar objetivos trimestrales
    DELETE FROM public.evaluation_objectives WHERE evaluation_id = v_leader_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Eval. Líder - Objetivos eliminados: %', v_deleted_count;
    
    -- Borrar recategorización
    DELETE FROM public.evaluation_recategorization WHERE evaluation_id = v_leader_eval_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE 'Eval. Líder - Recategorización eliminada: %', v_deleted_count;
    
    -- Resetear la evaluación
    UPDATE public.evaluations
    SET 
      status = 'draft',
      current_step = 0,
      total_score = NULL,
      dimension_scores = NULL,
      submitted_at = NULL,
      updated_at = now()
    WHERE id = v_leader_eval_id;
    
    RAISE NOTICE 'Evaluación de líder reiniciada: %', v_leader_eval_id;
  ELSE
    RAISE NOTICE 'No se encontró evaluación de líder activa';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Evaluaciones de Agustina Martinez Marques reiniciadas exitosamente';
END $$;

-- Verificación final
SELECT 
  e.first_name || ' ' || e.last_name as empleado,
  ev.type as tipo,
  ev.status as estado,
  ev.current_step as paso_actual,
  ev.total_score as puntaje,
  ep.name as periodo
FROM public.evaluations ev
JOIN public.employees e ON ev.employee_id = e.id
JOIN public.evaluation_periods ep ON ev.period_id = ep.id
WHERE LOWER(e.first_name) LIKE '%agustina%' 
  AND LOWER(e.last_name) LIKE '%martinez%marques%'
ORDER BY ev.type;
