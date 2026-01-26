-- Migration: Add new employee fields
-- Run this in the Supabase SQL Editor

-- Add personal and identity fields
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS cuil TEXT,
ADD COLUMN IF NOT EXISTS dni TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add education fields
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS education_title TEXT,
ADD COLUMN IF NOT EXISTS languages TEXT;

-- Add emergency contact fields
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_first_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_last_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.employees.birth_date IS 'Fecha de nacimiento';
COMMENT ON COLUMN public.employees.phone IS 'Teléfono de contacto';
COMMENT ON COLUMN public.employees.marital_status IS 'Estado civil: single, married, divorced, widowed, other';
COMMENT ON COLUMN public.employees.cuil IS 'CUIL (Argentina)';
COMMENT ON COLUMN public.employees.dni IS 'DNI / Documento Nacional de Identidad';
COMMENT ON COLUMN public.employees.job_title IS 'Rol / Puesto de trabajo';
COMMENT ON COLUMN public.employees.photo_url IS 'URL de la foto del empleado';
COMMENT ON COLUMN public.employees.education_level IS 'Nivel académico: primary, secondary, tertiary, university, postgraduate';
COMMENT ON COLUMN public.employees.education_title IS 'Título obtenido';
COMMENT ON COLUMN public.employees.languages IS 'Idiomas (separados por coma)';
COMMENT ON COLUMN public.employees.emergency_contact_relationship IS 'Parentesco del contacto de emergencia';
COMMENT ON COLUMN public.employees.emergency_contact_first_name IS 'Nombre del contacto de emergencia';
COMMENT ON COLUMN public.employees.emergency_contact_last_name IS 'Apellido del contacto de emergencia';
COMMENT ON COLUMN public.employees.emergency_contact_address IS 'Domicilio del contacto de emergencia';
COMMENT ON COLUMN public.employees.emergency_contact_phone IS 'Teléfono del contacto de emergencia';

-- Create storage bucket for employee photos (run this separately in Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true);
