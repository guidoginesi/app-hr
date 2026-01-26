-- Migration: Admin Objectives Module
-- Corporate objectives, seniority levels, and enhanced objectives tracking

-- 1. Add/update seniority_level to employees (format: "1.1", "2.3", "4.2", etc.)
-- First, drop any existing check constraint, then ensure column is TEXT type
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_seniority_level_check;

DO $$
BEGIN
  -- Check if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'seniority_level'
  ) THEN
    -- Column exists, check if it's INTEGER and convert to TEXT
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'employees' 
      AND column_name = 'seniority_level'
      AND data_type = 'integer'
    ) THEN
      ALTER TABLE public.employees ALTER COLUMN seniority_level TYPE TEXT USING seniority_level::TEXT;
    END IF;
  ELSE
    -- Column doesn't exist, create it
    ALTER TABLE public.employees ADD COLUMN seniority_level TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.employees.seniority_level IS 'Nivel de seniority (1.1-5.4) - Jr, Ssr, Sr, Líder, C-Level';

-- 2. Create seniority_history table to track promotions
CREATE TABLE IF NOT EXISTS public.seniority_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  previous_level TEXT,
  new_level TEXT NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seniority_history_employee ON public.seniority_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_seniority_history_date ON public.seniority_history(effective_date);

ALTER TABLE public.seniority_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage seniority history
DROP POLICY IF EXISTS "Admins can manage seniority history" ON public.seniority_history;
CREATE POLICY "Admins can manage seniority history"
  ON public.seniority_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.seniority_history IS 'Historial de cambios de nivel de seniority (promociones)';
COMMENT ON COLUMN public.seniority_history.previous_level IS 'Nivel anterior (null si es el nivel inicial)';
COMMENT ON COLUMN public.seniority_history.new_level IS 'Nuevo nivel asignado';
COMMENT ON COLUMN public.seniority_history.effective_date IS 'Fecha efectiva del cambio';

-- 2. Create corporate_objectives table
-- billing: 1 per year (annual)
-- nps: 4 per year (one per quarter: q1, q2, q3, q4)
CREATE TABLE IF NOT EXISTS public.corporate_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  objective_type TEXT NOT NULL CHECK (objective_type IN ('billing', 'nps')),
  quarter TEXT CHECK (quarter IN ('q1', 'q2', 'q3', 'q4') OR quarter IS NULL),
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL,
  gate_percentage INTEGER DEFAULT 90,
  cap_percentage INTEGER DEFAULT 150,
  floor_value DECIMAL,
  ceiling_value DECIMAL,
  actual_value DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, objective_type, quarter)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_corporate_objectives_year ON public.corporate_objectives(year);

-- Enable RLS
ALTER TABLE public.corporate_objectives ENABLE ROW LEVEL SECURITY;

-- RLS Policies for corporate_objectives
-- Only admins can manage corporate objectives
DROP POLICY IF EXISTS "Admins can manage corporate objectives" ON public.corporate_objectives;
CREATE POLICY "Admins can manage corporate objectives"
  ON public.corporate_objectives
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- All authenticated users can read corporate objectives
DROP POLICY IF EXISTS "Authenticated users can read corporate objectives" ON public.corporate_objectives;
CREATE POLICY "Authenticated users can read corporate objectives"
  ON public.corporate_objectives
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Comments
COMMENT ON TABLE public.corporate_objectives IS 'Objetivos corporativos anuales (Facturación, NPS) definidos por admins';
COMMENT ON COLUMN public.corporate_objectives.year IS 'Año del objetivo';
COMMENT ON COLUMN public.corporate_objectives.objective_type IS 'Tipo: billing (facturación) o nps';
COMMENT ON COLUMN public.corporate_objectives.target_value IS 'Meta objetivo (valor en $ para billing, score para NPS)';
COMMENT ON COLUMN public.corporate_objectives.gate_percentage IS 'Gate mínimo para habilitar bonus (default 90%)';
COMMENT ON COLUMN public.corporate_objectives.cap_percentage IS 'Tope de sobre-cumplimiento (default 150%)';
COMMENT ON COLUMN public.corporate_objectives.floor_value IS 'Piso (para NPS)';
COMMENT ON COLUMN public.corporate_objectives.ceiling_value IS 'Techo (para NPS)';
COMMENT ON COLUMN public.corporate_objectives.actual_value IS 'Valor real alcanzado';

-- 3. Add fields to existing objectives table
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS is_professional_development BOOLEAN DEFAULT false;
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS objective_number INTEGER CHECK (objective_number IN (1, 2));

COMMENT ON COLUMN public.objectives.is_professional_development IS 'Indica si es un objetivo de desarrollo profesional aplicado';
COMMENT ON COLUMN public.objectives.objective_number IS 'Número del objetivo de área (1 o 2)';

-- 4. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_corporate_objectives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger for updated_at
DROP TRIGGER IF EXISTS corporate_objectives_updated_at ON public.corporate_objectives;
CREATE TRIGGER corporate_objectives_updated_at
  BEFORE UPDATE ON public.corporate_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_corporate_objectives_updated_at();
