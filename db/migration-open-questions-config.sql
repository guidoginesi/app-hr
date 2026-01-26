-- Migration: Configurable Open Questions for Evaluations
-- This allows admins to configure the open-ended questions shown in evaluations

-- Table for configurable open questions
CREATE TABLE IF NOT EXISTS public.evaluation_open_question_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key TEXT NOT NULL,
  label_self TEXT NOT NULL,
  label_leader TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on question_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_open_question_config_key ON public.evaluation_open_question_config(question_key);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_open_question_config_order ON public.evaluation_open_question_config(sort_order);

-- Enable RLS
ALTER TABLE public.evaluation_open_question_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read open question config"
  ON public.evaluation_open_question_config
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage open question config"
  ON public.evaluation_open_question_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE public.evaluation_open_question_config IS 'Configuración de preguntas abiertas para evaluaciones';
COMMENT ON COLUMN public.evaluation_open_question_config.question_key IS 'Clave única para identificar la pregunta (ej: strengths, growth_areas)';
COMMENT ON COLUMN public.evaluation_open_question_config.label_self IS 'Texto de la pregunta para autoevaluación';
COMMENT ON COLUMN public.evaluation_open_question_config.label_leader IS 'Texto de la pregunta para evaluación de líder';
COMMENT ON COLUMN public.evaluation_open_question_config.description IS 'Descripción o instrucciones adicionales';
COMMENT ON COLUMN public.evaluation_open_question_config.is_active IS 'Si la pregunta está activa y se muestra en evaluaciones';
COMMENT ON COLUMN public.evaluation_open_question_config.sort_order IS 'Orden de aparición';

-- Insert default questions (same as the hardcoded ones)
INSERT INTO public.evaluation_open_question_config (question_key, label_self, label_leader, sort_order) VALUES
  ('strengths', '¿Cuáles consideras que son tus principales fortalezas?', '¿Cuáles consideras que son las principales fortalezas del colaborador?', 1),
  ('growth_areas', '¿En qué aspectos consideras que deberías crecer o mejorar?', '¿En qué debería enfocarse para crecer o mejorar?', 2),
  ('leader_support', '¿Qué necesitás de tu líder para cumplir tus objetivos?', '¿Qué necesita de vos como líder para cumplir sus objetivos?', 3)
ON CONFLICT (question_key) DO NOTHING;
