-- Migration: Add recommended_level to evaluation_recategorization
-- This allows specifying the new sub-level for recategorization

-- Add column for the recommended new level
ALTER TABLE public.evaluation_recategorization
ADD COLUMN IF NOT EXISTS recommended_level TEXT;

-- Add comment
COMMENT ON COLUMN public.evaluation_recategorization.recommended_level IS 'Nivel recomendado para la recategorización (ej: 3.2, 3.3, 4.1)';
