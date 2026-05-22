-- Migration: Entrenamiento IA — ranking de capacitaciones internas

CREATE TABLE IF NOT EXISTS public.ai_training_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.ai_training_cycles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  session_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_training_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_training_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT false,
  participation_count INTEGER NOT NULL DEFAULT 0 CHECK (participation_count >= 0 AND participation_count <= 10),
  exam_score INTEGER CHECK (exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 100)),
  activity_on_time BOOLEAN NOT NULL DEFAULT false,
  manual_adjustment INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_training_sessions_cycle ON public.ai_training_sessions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_sessions_date ON public.ai_training_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_training_scores_session ON public.ai_training_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_scores_employee ON public.ai_training_scores(employee_id);

CREATE OR REPLACE VIEW public.ai_training_rankings AS
SELECT
  c.id AS cycle_id,
  c.name AS cycle_name,
  c.is_active AS cycle_is_active,
  e.id AS employee_id,
  e.first_name,
  e.last_name,
  e.photo_url,
  e.job_title,
  e.department_id,
  d.name AS department_name,
  COALESCE(SUM(s.total_points), 0)::INTEGER AS total_points,
  COUNT(s.id) FILTER (WHERE s.total_points > 0)::INTEGER AS sessions_scored
FROM public.ai_training_cycles c
CROSS JOIN public.employees e
LEFT JOIN public.departments d ON e.department_id = d.id
LEFT JOIN public.ai_training_sessions sess ON sess.cycle_id = c.id
LEFT JOIN public.ai_training_scores s ON s.session_id = sess.id AND s.employee_id = e.id
WHERE e.status = 'active'
GROUP BY c.id, c.name, c.is_active, e.id, e.first_name, e.last_name, e.photo_url, e.job_title, e.department_id, d.name;

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

INSERT INTO public.ai_training_cycles (name, description, is_active, start_date)
SELECT
  'Ciclo actual',
  'Ranking de capacitaciones internas de Entrenamiento IA',
  true,
  CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.ai_training_cycles LIMIT 1);

ALTER TABLE public.ai_training_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ai_training_cycles"
  ON public.ai_training_cycles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage ai_training_cycles"
  ON public.ai_training_cycles FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated can read ai_training_sessions"
  ON public.ai_training_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage ai_training_sessions"
  ON public.ai_training_sessions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees read own ai_training_scores"
  ON public.ai_training_scores FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins manage ai_training_scores"
  ON public.ai_training_scores FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.ai_training_cycles IS 'Ciclos de capacitación IA (ej. trimestre, cohorte).';
COMMENT ON TABLE public.ai_training_sessions IS 'Sesiones individuales dentro de un ciclo.';
COMMENT ON TABLE public.ai_training_scores IS 'Puntaje por empleado y sesión.';
