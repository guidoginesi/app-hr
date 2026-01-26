-- Migration: Configurable Evaluation Modules
-- Allows enabling/disabling objectives and recategorization per evaluation period

-- Add configuration columns to evaluation_periods
ALTER TABLE public.evaluation_periods 
ADD COLUMN IF NOT EXISTS objectives_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS recategorization_enabled BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN public.evaluation_periods.objectives_enabled IS 'Si está habilitado el módulo de cumplimiento de objetivos';
COMMENT ON COLUMN public.evaluation_periods.recategorization_enabled IS 'Si está habilitado el módulo de recategorización/ascenso';
