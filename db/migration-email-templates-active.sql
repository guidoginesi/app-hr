-- Agregar columna is_active a email_templates
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Todos los templates existentes están activos por defecto
UPDATE public.email_templates SET is_active = true WHERE is_active IS NULL;

