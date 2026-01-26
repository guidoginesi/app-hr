-- Migration: People Module
-- Creates tables for employee management, legal entities, departments, and user roles

-- ==========================================
-- 1. Legal Entities (Sociedades)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.legal_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_legal_entities_updated_at
  BEFORE UPDATE ON public.legal_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 2. Departments
-- ==========================================
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Index for legal_entity lookup
CREATE INDEX IF NOT EXISTS idx_departments_legal_entity ON public.departments(legal_entity_id);

-- ==========================================
-- 3. User Roles (replaces admins table logic)
-- ==========================================
CREATE TYPE user_role AS ENUM ('admin', 'employee', 'leader');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Migrate existing admins to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::user_role
FROM public.admins
ON CONFLICT (user_id, role) DO NOTHING;

-- ==========================================
-- 4. Employee Status Enum
-- ==========================================
CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'terminated');

-- ==========================================
-- 5. Employees Table
-- ==========================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Personal details
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  personal_email TEXT NOT NULL,
  work_email TEXT,
  nationality TEXT,
  
  -- Address
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  
  -- Organization
  legal_entity_id UUID REFERENCES public.legal_entities(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  
  -- From recruiting (optional link)
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  
  -- Employment info
  status employee_status NOT NULL DEFAULT 'active',
  hire_date DATE,
  termination_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_user ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_legal_entity ON public.employees(legal_entity_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_application ON public.employees(application_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(personal_email);

-- ==========================================
-- 6. Helper function to check if user is a leader
-- ==========================================
CREATE OR REPLACE FUNCTION is_user_leader(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE manager_id IN (
      SELECT id FROM public.employees WHERE user_id = p_user_id
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 7. View for employee with manager info
-- ==========================================
CREATE OR REPLACE VIEW public.employees_with_details AS
SELECT 
  e.*,
  le.name AS legal_entity_name,
  d.name AS department_name,
  CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
  m.id AS manager_employee_id
FROM public.employees e
LEFT JOIN public.legal_entities le ON e.legal_entity_id = le.id
LEFT JOIN public.departments d ON e.department_id = d.id
LEFT JOIN public.employees m ON e.manager_id = m.id;
