-- Migration: Add evaluation window dates
-- Run this ONLY if you already ran the initial migration-evaluations.sql
-- If you haven't run the migration yet, use the updated migration-evaluations.sql instead

ALTER TABLE public.evaluation_periods 
ADD COLUMN IF NOT EXISTS evaluation_start_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_end_date DATE;

COMMENT ON COLUMN public.evaluation_periods.start_date IS 'Fecha de inicio del período evaluado (ej: 01/01/2025)';
COMMENT ON COLUMN public.evaluation_periods.end_date IS 'Fecha de fin del período evaluado (ej: 31/12/2025)';
COMMENT ON COLUMN public.evaluation_periods.evaluation_start_date IS 'Fecha de inicio de la ventana para completar evaluaciones';
COMMENT ON COLUMN public.evaluation_periods.evaluation_end_date IS 'Fecha de fin de la ventana para completar evaluaciones';
