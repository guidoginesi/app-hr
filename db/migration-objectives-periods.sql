-- Migration: Objectives Periods and Achievement
-- Adds period configuration and achievement tracking for objectives

-- 1. Create objectives_periods table
CREATE TABLE IF NOT EXISTS public.objectives_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('definition', 'evaluation')),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, period_type),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_objectives_periods_year ON public.objectives_periods(year);
CREATE INDEX IF NOT EXISTS idx_objectives_periods_active ON public.objectives_periods(is_active);

ALTER TABLE public.objectives_periods ENABLE ROW LEVEL SECURITY;

-- Admins can manage periods
DROP POLICY IF EXISTS "Admins can manage objectives periods" ON public.objectives_periods;
CREATE POLICY "Admins can manage objectives periods"
  ON public.objectives_periods
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- All authenticated users can read periods
DROP POLICY IF EXISTS "Authenticated users can read objectives periods" ON public.objectives_periods;
CREATE POLICY "Authenticated users can read objectives periods"
  ON public.objectives_periods
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.objectives_periods IS 'Períodos de definición y evaluación de objetivos';
COMMENT ON COLUMN public.objectives_periods.period_type IS 'definition = crear/editar objetivos, evaluation = registrar cumplimiento';
COMMENT ON COLUMN public.objectives_periods.start_date IS 'Fecha de inicio del período';
COMMENT ON COLUMN public.objectives_periods.end_date IS 'Fecha de cierre del período';

-- 2. Add achievement fields to objectives table
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS achievement_percentage INTEGER 
  CHECK (achievement_percentage >= 0 AND achievement_percentage <= 200);
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS achievement_notes TEXT;
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS evaluated_by UUID REFERENCES public.employees(id);
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.objectives.achievement_percentage IS 'Porcentaje de cumplimiento real (0-200% para sobrecumplimiento)';
COMMENT ON COLUMN public.objectives.achievement_notes IS 'Notas del evaluador sobre el cumplimiento';
COMMENT ON COLUMN public.objectives.evaluated_at IS 'Fecha de evaluación del cumplimiento';
COMMENT ON COLUMN public.objectives.evaluated_by IS 'Quién evaluó el cumplimiento';
COMMENT ON COLUMN public.objectives.is_locked IS 'Objetivo bloqueado (no editable)';

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_objectives_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for updated_at
DROP TRIGGER IF EXISTS objectives_periods_updated_at ON public.objectives_periods;
CREATE TRIGGER objectives_periods_updated_at
  BEFORE UPDATE ON public.objectives_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_objectives_periods_updated_at();

-- 5. Function to check if a period is currently open
CREATE OR REPLACE FUNCTION public.is_objectives_period_open(p_year INTEGER, p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.objectives_periods
    WHERE year = p_year
      AND period_type = p_type
      AND is_active = true
      AND CURRENT_DATE BETWEEN start_date AND end_date
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.is_objectives_period_open IS 'Verifica si un período de objetivos está actualmente abierto';
