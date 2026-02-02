-- Migration: Agregar campo employment_type (Condición laboral)
-- Valores: 'monotributista' o 'dependency' (relación de dependencia)

-- Agregar columna a la tabla employees
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT NULL;

-- Agregar comentario
COMMENT ON COLUMN public.employees.employment_type IS 'Condición laboral: monotributista o dependency (relación de dependencia)';

-- Opcional: Agregar constraint para validar valores
ALTER TABLE public.employees
ADD CONSTRAINT check_employment_type 
CHECK (employment_type IS NULL OR employment_type IN ('monotributista', 'dependency'));
