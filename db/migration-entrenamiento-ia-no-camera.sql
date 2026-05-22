-- Migration: quitar métrica de cámara prendida en Entrenamiento IA

UPDATE public.ai_training_scores
SET total_points =
  (CASE WHEN attended THEN 10 ELSE 0 END) +
  (LEAST(GREATEST(participation_count, 0), 3) * 5) +
  (CASE WHEN exam_score IS NOT NULL AND exam_score >= 70 THEN 15 ELSE 0 END) +
  (CASE WHEN exam_score = 100 THEN 5 ELSE 0 END) +
  (CASE WHEN activity_on_time THEN 10 ELSE 0 END) +
  COALESCE(manual_adjustment, 0);

CREATE OR REPLACE VIEW public.ai_training_score_details AS
SELECT
  s.id,
  s.session_id,
  sess.title AS session_title,
  sess.session_date,
  sess.cycle_id,
  c.name AS cycle_name,
  s.employee_id,
  e.first_name,
  e.last_name,
  s.attended,
  s.participation_count,
  s.exam_score,
  s.activity_on_time,
  s.manual_adjustment,
  s.total_points,
  s.notes,
  s.updated_at
FROM public.ai_training_scores s
JOIN public.ai_training_sessions sess ON sess.id = s.session_id
JOIN public.ai_training_cycles c ON c.id = sess.cycle_id
JOIN public.employees e ON e.id = s.employee_id;

ALTER TABLE public.ai_training_scores DROP COLUMN IF EXISTS camera_on;
