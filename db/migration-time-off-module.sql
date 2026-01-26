-- Migration: Time-Off Module
-- Creates tables for leave management: types, requests, balances, and remote work tracking

-- ==========================================
-- 1. Leave Types (Tipos de licencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'vacation', 'pow_days', 'study', 'remote_work'
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_attachment BOOLEAN DEFAULT false,
  advance_notice_days INTEGER DEFAULT 0, -- dias de anticipacion requeridos
  count_type TEXT NOT NULL, -- 'calendar_days', 'business_days', 'weeks'
  is_accumulative BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_leave_types_updated_at
  BEFORE UPDATE ON public.leave_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 2. Leave Request Status Enum
-- ==========================================
CREATE TYPE leave_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- ==========================================
-- 3. Leave Requests (Solicitudes de licencia)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5,1) NOT NULL,
  status leave_request_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  attachment_url TEXT, -- para certificados de examen
  approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validacion: end_date >= start_date
  CONSTRAINT leave_requests_valid_dates CHECK (end_date >= start_date)
);

-- Trigger for updated_at
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_leave_type ON public.leave_requests(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON public.leave_requests(approved_by);

-- ==========================================
-- 4. Leave Balances (Balances por empleado/año)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  entitled_days NUMERIC(5,1) DEFAULT 0, -- dias correspondientes
  used_days NUMERIC(5,1) DEFAULT 0,
  pending_days NUMERIC(5,1) DEFAULT 0, -- dias en solicitudes pendientes
  carried_over NUMERIC(5,1) DEFAULT 0, -- dias acumulados de anos anteriores
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(employee_id, leave_type_id, year)
);

-- Trigger for updated_at
CREATE TRIGGER update_leave_balances_updated_at
  BEFORE UPDATE ON public.leave_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON public.leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON public.leave_balances(year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year);

-- ==========================================
-- 5. Remote Work Weeks (Semanas de trabajo remoto)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.remote_work_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL, -- semana ISO del ano (1-53)
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(employee_id, year, week_number),
  CONSTRAINT remote_work_weeks_valid_week CHECK (week_number >= 1 AND week_number <= 53)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remote_work_weeks_employee ON public.remote_work_weeks(employee_id);
CREATE INDEX IF NOT EXISTS idx_remote_work_weeks_year ON public.remote_work_weeks(year);
CREATE INDEX IF NOT EXISTS idx_remote_work_weeks_request ON public.remote_work_weeks(leave_request_id);

-- ==========================================
-- 6. Modify Employees Table - Add is_studying
-- ==========================================
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT false;

-- ==========================================
-- 7. Function to Calculate Vacation Days by Seniority
-- Based on Ley 20.744 Art. 150 (Argentina)
-- ==========================================
CREATE OR REPLACE FUNCTION calculate_vacation_days(p_hire_date DATE, p_reference_date DATE)
RETURNS INTEGER AS $$
DECLARE
  v_years_worked NUMERIC;
BEGIN
  -- Calculate years worked at reference date (usually Dec 31 of the year)
  v_years_worked := EXTRACT(YEAR FROM age(p_reference_date, p_hire_date));
  
  -- Return days according to Argentine Labor Law
  IF v_years_worked >= 20 THEN 
    RETURN 35;
  ELSIF v_years_worked >= 10 THEN 
    RETURN 28;
  ELSIF v_years_worked >= 5 THEN 
    RETURN 21;
  ELSE 
    RETURN 14;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- 8. View for Leave Requests with Details
-- ==========================================
CREATE OR REPLACE VIEW public.leave_requests_with_details AS
SELECT 
  lr.*,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.requires_attachment,
  lt.advance_notice_days,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.photo_url AS employee_photo_url,
  e.manager_id AS employee_manager_id,
  CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
  CONCAT(a.first_name, ' ', a.last_name) AS approver_name
FROM public.leave_requests lr
JOIN public.leave_types lt ON lr.leave_type_id = lt.id
JOIN public.employees e ON lr.employee_id = e.id
LEFT JOIN public.employees m ON e.manager_id = m.id
LEFT JOIN public.employees a ON lr.approved_by = a.id;

-- ==========================================
-- 9. View for Leave Balances with Details
-- ==========================================
CREATE OR REPLACE VIEW public.leave_balances_with_details AS
SELECT 
  lb.*,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.is_accumulative,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.hire_date,
  e.is_studying,
  -- Calculated available days
  (lb.entitled_days + lb.carried_over - lb.used_days - lb.pending_days) AS available_days
FROM public.leave_balances lb
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
JOIN public.employees e ON lb.employee_id = e.id;

-- ==========================================
-- 10. Seed Data - Initial Leave Types
-- ==========================================
INSERT INTO public.leave_types (code, name, description, requires_attachment, advance_notice_days, count_type, is_accumulative) VALUES
('vacation', 'Vacaciones', 'Licencia ordinaria según Ley 20.744 Art. 150', false, 45, 'calendar_days', true),
('pow_days', 'Días Pow', '5 días hábiles extra anuales para empleados full-time con más de 6 meses', false, 0, 'business_days', true),
('study', 'Licencia por Estudio', '2 días corridos por examen, máximo 10 días por año calendario', true, 0, 'calendar_days', false),
('remote_work', 'Trabajo Remoto', '8 semanas por año, semanas completas de lunes a domingo', false, 7, 'weeks', false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  requires_attachment = EXCLUDED.requires_attachment,
  advance_notice_days = EXCLUDED.advance_notice_days,
  count_type = EXCLUDED.count_type,
  is_accumulative = EXCLUDED.is_accumulative;

-- ==========================================
-- 11. RLS Policies
-- ==========================================

-- Enable RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_work_weeks ENABLE ROW LEVEL SECURITY;

-- Leave Types: Everyone can read active types
CREATE POLICY "Anyone can read active leave types" ON public.leave_types
  FOR SELECT USING (is_active = true);

-- Leave Requests: Employees can see their own, managers can see their team's
CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can create own leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can update own pending requests" ON public.leave_requests
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND status = 'pending'
  );

-- Managers can view and approve team requests
CREATE POLICY "Managers can view team leave requests" ON public.leave_requests
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Managers can update team leave requests" ON public.leave_requests
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- Leave Balances: Employees can see their own
CREATE POLICY "Employees can view own leave balances" ON public.leave_balances
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Managers can view team balances
CREATE POLICY "Managers can view team leave balances" ON public.leave_balances
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- Remote Work Weeks: Same as leave requests
CREATE POLICY "Employees can view own remote work weeks" ON public.remote_work_weeks
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Managers can view team remote work weeks" ON public.remote_work_weeks
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM public.employees 
      WHERE manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );
