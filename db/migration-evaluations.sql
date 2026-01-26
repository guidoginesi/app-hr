-- Migration: Performance Evaluation Module
-- Run this in the Supabase SQL Editor

-- =============================================
-- EVALUATION PERIODS
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  -- Período evaluado (ej: Ene-Dic 2025)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Ventana para completar la evaluación
  evaluation_start_date DATE,
  evaluation_end_date DATE,
  is_active BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  self_evaluation_enabled BOOLEAN DEFAULT true,
  leader_evaluation_enabled BOOLEAN DEFAULT true,
  show_results_to_employee BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_periods_year ON public.evaluation_periods(year);
CREATE INDEX IF NOT EXISTS idx_evaluation_periods_is_active ON public.evaluation_periods(is_active);

-- =============================================
-- EVALUATION DIMENSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.evaluation_periods(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_dimensions_period ON public.evaluation_dimensions(period_id);

-- =============================================
-- EVALUATION ITEMS (3 per dimension)
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id UUID NOT NULL REFERENCES public.evaluation_dimensions(id) ON DELETE CASCADE,
  statement TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluation_items_dimension ON public.evaluation_items(dimension_id);

-- =============================================
-- EVALUATIONS (individual evaluation sessions)
-- =============================================
CREATE TYPE evaluation_type AS ENUM ('self', 'leader');
CREATE TYPE evaluation_status AS ENUM ('draft', 'in_progress', 'submitted');

CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.evaluation_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type evaluation_type NOT NULL,
  status evaluation_status NOT NULL DEFAULT 'draft',
  current_step INTEGER DEFAULT 0,
  total_score DECIMAL(4,2),
  dimension_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  UNIQUE(period_id, employee_id, evaluator_id, type)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_period ON public.evaluations(period_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_employee ON public.evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON public.evaluations(status);

-- =============================================
-- EVALUATION RESPONSES (scores per item)
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.evaluation_items(id) ON DELETE CASCADE,
  score INTEGER CHECK (score >= 1 AND score <= 10),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_responses_evaluation ON public.evaluation_responses(evaluation_id);

-- =============================================
-- EVALUATION OPEN QUESTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_open_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_open_questions_evaluation ON public.evaluation_open_questions(evaluation_id);

-- =============================================
-- EVALUATION OBJECTIVES (quarterly, for leader eval)
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  objectives_description TEXT,
  completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(evaluation_id, quarter)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_objectives_evaluation ON public.evaluation_objectives(evaluation_id);

-- =============================================
-- EVALUATION RECATEGORIZATION (final results, leader eval)
-- =============================================
CREATE TABLE IF NOT EXISTS public.evaluation_recategorization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL UNIQUE REFERENCES public.evaluations(id) ON DELETE CASCADE,
  level_recategorization TEXT CHECK (level_recategorization IN ('approved', 'not_approved')),
  position_recategorization TEXT CHECK (position_recategorization IN ('approved', 'not_approved')),
  self_score DECIMAL(4,2),
  leader_score DECIMAL(4,2),
  gap DECIMAL(4,2),
  objectives_average DECIMAL(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE public.evaluation_periods IS 'Períodos de evaluación (ej: 2025)';
COMMENT ON TABLE public.evaluation_dimensions IS 'Dimensiones configurables para cada período';
COMMENT ON TABLE public.evaluation_items IS 'Ítems/afirmaciones por dimensión (3 por dimensión)';
COMMENT ON TABLE public.evaluations IS 'Sesiones individuales de evaluación';
COMMENT ON TABLE public.evaluation_responses IS 'Respuestas/puntuaciones por ítem';
COMMENT ON TABLE public.evaluation_open_questions IS 'Respuestas a preguntas abiertas';
COMMENT ON TABLE public.evaluation_objectives IS 'Objetivos trimestrales (evaluación de líder)';
COMMENT ON TABLE public.evaluation_recategorization IS 'Recategorización final (evaluación de líder)';

COMMENT ON COLUMN public.evaluations.type IS 'self = autoevaluación, leader = evaluación del líder';
COMMENT ON COLUMN public.evaluations.status IS 'draft = borrador, in_progress = en progreso, submitted = enviada';
COMMENT ON COLUMN public.evaluations.dimension_scores IS 'JSON con promedios por dimensión: {"dimension_id": score}';

-- =============================================
-- SEED DEFAULT DIMENSIONS FOR TESTING
-- This creates a sample period with the 6 standard dimensions
-- =============================================
-- Uncomment and run separately if you want sample data:
/*
INSERT INTO public.evaluation_periods (name, year, start_date, end_date, is_active, status)
VALUES ('Evaluación de Desempeño 2025', 2025, '2025-01-01', '2025-12-31', true, 'open')
RETURNING id;

-- Use the returned ID to insert dimensions:
-- INSERT INTO public.evaluation_dimensions (period_id, name, description, order_index) VALUES
-- ('PERIOD_ID', 'Compromiso y responsabilidad', 'Nivel de compromiso con las tareas y responsabilidades asignadas', 1),
-- ('PERIOD_ID', 'Calidad y ejecución del trabajo', 'Calidad en la entrega y ejecución de las tareas', 2),
-- ('PERIOD_ID', 'Autonomía y organización', 'Capacidad de trabajar de forma autónoma y organizada', 3),
-- ('PERIOD_ID', 'Comunicación y trabajo en equipo', 'Habilidades de comunicación y colaboración', 4),
-- ('PERIOD_ID', 'Adaptabilidad y aprendizaje', 'Capacidad de adaptarse y aprender continuamente', 5),
-- ('PERIOD_ID', 'Aporte a la cultura POW', 'Contribución a la cultura organizacional', 6);
*/
