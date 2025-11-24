-- Migración: Agregar campos para filtros automáticos
-- 1. max_salary en jobs (para el umbral de sueldo)
-- 2. salary_expectation y english_level en applications (datos del candidato)

-- Agregar max_salary a jobs
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS max_salary numeric(12,2);

COMMENT ON COLUMN public.jobs.max_salary IS 'Salario máximo de la posición. Si un candidato pide más, se descarta automáticamente.';

-- Agregar salary_expectation y english_level a applications
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS salary_expectation text;

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS english_level text;

COMMENT ON COLUMN public.applications.salary_expectation IS 'Expectativa salarial del candidato (texto libre, se compara con max_salary del job)';
COMMENT ON COLUMN public.applications.english_level IS 'Nivel de inglés del candidato';

