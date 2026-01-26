-- Migration: Objectives Module
-- Separate module for managing employee objectives

-- Create objectives table
CREATE TABLE IF NOT EXISTS public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.employees(id),
  year INTEGER NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('annual', 'q1', 'q2', 'q3', 'q4')),
  title TEXT NOT NULL,
  description TEXT,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_objectives_employee ON public.objectives(employee_id);
CREATE INDEX IF NOT EXISTS idx_objectives_created_by ON public.objectives(created_by);
CREATE INDEX IF NOT EXISTS idx_objectives_year ON public.objectives(year);
CREATE INDEX IF NOT EXISTS idx_objectives_period ON public.objectives(year, period_type);

-- Enable RLS
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Employees can read their own objectives
CREATE POLICY "Employees can read own objectives"
  ON public.objectives
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Leaders can read objectives of their direct reports
CREATE POLICY "Leaders can read team objectives"
  ON public.objectives
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
      )
    )
  );

-- Leaders can create objectives for their direct reports
CREATE POLICY "Leaders can create team objectives"
  ON public.objectives
  FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (
        SELECT id FROM public.employees WHERE user_id = auth.uid()
      )
    )
  );

-- Leaders can update objectives they created for their team
CREATE POLICY "Leaders can update team objectives"
  ON public.objectives
  FOR UPDATE
  USING (
    created_by IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Leaders can delete objectives they created for their team
CREATE POLICY "Leaders can delete team objectives"
  ON public.objectives
  FOR DELETE
  USING (
    created_by IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all objectives
CREATE POLICY "Admins can manage all objectives"
  ON public.objectives
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE public.objectives IS 'Objetivos de empleados gestionados por líderes';
COMMENT ON COLUMN public.objectives.employee_id IS 'Empleado al que se asigna el objetivo';
COMMENT ON COLUMN public.objectives.created_by IS 'Líder que creó el objetivo';
COMMENT ON COLUMN public.objectives.year IS 'Año del objetivo';
COMMENT ON COLUMN public.objectives.period_type IS 'Tipo de período: annual, q1, q2, q3, q4';
COMMENT ON COLUMN public.objectives.progress_percentage IS 'Porcentaje de cumplimiento 0-100';
COMMENT ON COLUMN public.objectives.status IS 'Estado: not_started, in_progress, completed';
