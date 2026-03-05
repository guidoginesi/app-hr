-- Migration: Employee Certificates
-- Allows employees to upload documents (medical, exam, travel certificates)

CREATE TABLE IF NOT EXISTS public.employee_certificates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('exam', 'medical', 'travel_assistance')),
  file_path     text NOT NULL,
  file_name     text NOT NULL,
  file_size     int,
  notes         text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_certificates_employee ON public.employee_certificates(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_certificates_type ON public.employee_certificates(type);
CREATE INDEX IF NOT EXISTS idx_employee_certificates_uploaded_at ON public.employee_certificates(uploaded_at DESC);

-- Storage bucket: run this only if the bucket doesn't exist yet
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false)
-- ON CONFLICT (id) DO NOTHING;
