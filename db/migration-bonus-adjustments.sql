-- Migration: Tabla para registrar ajustes de días bonus
-- Permite trackear, mostrar y cancelar ajustes de días extra

-- ==========================================
-- 1. Tabla de ajustes de bonus
-- ==========================================
CREATE TABLE IF NOT EXISTS public.bonus_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  year INTEGER NOT NULL,
  days NUMERIC(5,1) NOT NULL, -- Puede ser positivo (agregar) o negativo (quitar)
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled'
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- Admin que creó
  cancelled_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_bonus_adjustments_updated_at ON public.bonus_adjustments;
CREATE TRIGGER update_bonus_adjustments_updated_at
  BEFORE UPDATE ON public.bonus_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bonus_adjustments_employee ON public.bonus_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_bonus_adjustments_year ON public.bonus_adjustments(year);
CREATE INDEX IF NOT EXISTS idx_bonus_adjustments_status ON public.bonus_adjustments(status);

-- ==========================================
-- 2. Vista con detalles
-- ==========================================
CREATE OR REPLACE VIEW public.bonus_adjustments_with_details
WITH (security_invoker = true)
AS
SELECT 
  ba.id,
  ba.employee_id,
  ba.leave_type_id,
  ba.year,
  ba.days,
  ba.reason,
  ba.status,
  ba.created_by,
  ba.cancelled_by,
  ba.cancelled_at,
  ba.cancellation_reason,
  ba.created_at,
  ba.updated_at,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  CONCAT(cb.first_name, ' ', cb.last_name) AS created_by_name,
  CONCAT(canc.first_name, ' ', canc.last_name) AS cancelled_by_name
FROM public.bonus_adjustments ba
JOIN public.employees e ON ba.employee_id = e.id
JOIN public.leave_types lt ON ba.leave_type_id = lt.id
LEFT JOIN public.employees cb ON ba.created_by = cb.id
LEFT JOIN public.employees canc ON ba.cancelled_by = canc.id;

-- ==========================================
-- 3. RLS Policies
-- ==========================================
ALTER TABLE public.bonus_adjustments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage bonus adjustments" ON public.bonus_adjustments;
DROP POLICY IF EXISTS "Employees can view own bonus adjustments" ON public.bonus_adjustments;

-- Solo admins pueden ver y gestionar ajustes de bonus
CREATE POLICY "Admins can manage bonus adjustments" ON public.bonus_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Empleados pueden ver sus propios ajustes
CREATE POLICY "Employees can view own bonus adjustments" ON public.bonus_adjustments
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );
