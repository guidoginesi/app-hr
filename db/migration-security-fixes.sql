-- Migration: Security Fixes for Supabase Linter Errors
-- Fixes:
-- 1. Views with SECURITY DEFINER property → Use SECURITY INVOKER
-- 2. Tables without RLS enabled → Enable RLS and create appropriate policies
-- 
-- IMPORTANT: Run this migration in the Supabase SQL Editor

-- =============================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- =============================================
-- These views need to be recreated with security_invoker = true
-- This ensures RLS policies are enforced based on the querying user, not the view creator

-- 1.1 Fix leave_requests_with_details view
DROP VIEW IF EXISTS public.leave_requests_with_details;

CREATE VIEW public.leave_requests_with_details
WITH (security_invoker = true)
AS
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
  CONCAT(a.first_name, ' ', a.last_name) AS approver_name,
  -- Two-level approval fields
  CONCAT(l.first_name, ' ', l.last_name) AS leader_name,
  CONCAT(hr.first_name, ' ', hr.last_name) AS hr_approver_name
FROM public.leave_requests lr
JOIN public.leave_types lt ON lr.leave_type_id = lt.id
JOIN public.employees e ON lr.employee_id = e.id
LEFT JOIN public.employees m ON e.manager_id = m.id
LEFT JOIN public.employees a ON lr.approved_by = a.id
LEFT JOIN public.employees l ON lr.leader_id = l.id
LEFT JOIN public.employees hr ON lr.hr_approved_by = hr.id;

COMMENT ON VIEW public.leave_requests_with_details IS 
  'Leave requests with employee and type details. Uses security_invoker for RLS compliance.';

-- 1.2 Fix employees_with_details view
DROP VIEW IF EXISTS public.employees_with_details;

CREATE VIEW public.employees_with_details
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.employees_with_details IS 
  'Employees with legal entity, department, and manager details. Uses security_invoker for RLS compliance.';

-- 1.3 Fix leave_balances_with_details view
DROP VIEW IF EXISTS public.leave_balances_with_details;

CREATE VIEW public.leave_balances_with_details
WITH (security_invoker = true)
AS
SELECT 
  lb.id,
  lb.employee_id,
  lb.leave_type_id,
  lb.year,
  lb.entitled_days,
  lb.used_days,
  lb.pending_days,
  lb.carried_over,
  lb.bonus_days,
  lb.created_at,
  lb.updated_at,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.is_accumulative,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.hire_date,
  e.is_studying,
  -- Calculated available days (includes bonus_days)
  (lb.entitled_days + lb.carried_over + COALESCE(lb.bonus_days, 0) - lb.used_days - lb.pending_days) AS available_days
FROM public.leave_balances lb
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
JOIN public.employees e ON lb.employee_id = e.id;

COMMENT ON VIEW public.leave_balances_with_details IS 
  'Leave balances with details. available_days = entitled + carried_over + bonus - used - pending. Uses security_invoker for RLS compliance.';

-- =============================================
-- PART 2: ENABLE RLS ON TABLES WITHOUT IT
-- =============================================

-- =============================================
-- 2.1 RECRUITING MODULE TABLES
-- =============================================

-- Jobs table - Admins only for management, public read for job listings
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Admin management policy - uses WITH CHECK for INSERT/UPDATE operations
CREATE POLICY "Admins can manage jobs" ON public.jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Public read policy - allows anyone (including anonymous) to read published jobs
CREATE POLICY "Anyone can read published jobs" ON public.jobs
  FOR SELECT USING (is_published = true);

-- Candidates table - Admins only
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage candidates" ON public.candidates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Applications table - Admins only
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage applications" ON public.applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Stage History table - Admins only
ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stage history" ON public.stage_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Rating History table - Admins only
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rating history" ON public.rating_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Recruiter Notes table - Admins only
ALTER TABLE public.recruiter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recruiter notes" ON public.recruiter_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 2.2 EMAIL TABLES
-- =============================================

-- Email Templates - Admins can manage, authenticated users can read
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email templates" ON public.email_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read email templates" ON public.email_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Email Logs - Admins only
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email logs" ON public.email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 2.3 PEOPLE MODULE TABLES
-- =============================================

-- Legal Entities - Authenticated users can read
-- Writes are done via service_role which bypasses RLS
ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read legal_entities" ON public.legal_entities
  FOR SELECT
  TO authenticated
  USING (true);

-- Departments - Authenticated users can read
-- Writes are done via service_role which bypasses RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read departments" ON public.departments
  FOR SELECT
  TO authenticated
  USING (true);

-- User Roles - Authenticated users can read (needed for auth middleware)
-- Writes are done via service_role which bypasses RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read user_roles" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Admins table - Authenticated users can read (needed for auth middleware)
-- Writes are done via service_role which bypasses RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read admins" ON public.admins
  FOR SELECT
  TO authenticated
  USING (true);

-- Employees - Authenticated users can read
-- Writes are done via service_role which bypasses RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read employees" ON public.employees
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 2.4 BENEFITS TABLES
-- =============================================

-- Benefits - Authenticated users can read, admins can manage
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage benefits" ON public.benefits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read benefits" ON public.benefits
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Benefit Items - Same as benefits
ALTER TABLE public.benefit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage benefit items" ON public.benefit_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read benefit items" ON public.benefit_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =============================================
-- 2.5 EVALUATION MODULE TABLES
-- =============================================

-- Evaluation Periods - Authenticated can read, admins can manage
ALTER TABLE public.evaluation_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evaluation periods" ON public.evaluation_periods
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read evaluation periods" ON public.evaluation_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Evaluation Dimensions - Authenticated can read, admins can manage
ALTER TABLE public.evaluation_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evaluation dimensions" ON public.evaluation_dimensions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read evaluation dimensions" ON public.evaluation_dimensions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Evaluation Items - Authenticated can read, admins can manage
ALTER TABLE public.evaluation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evaluation items" ON public.evaluation_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read evaluation items" ON public.evaluation_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Evaluations - Complex policies
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all evaluations" ON public.evaluations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own evaluations" ON public.evaluations
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

CREATE POLICY "Evaluators can manage their evaluations" ON public.evaluations
  FOR ALL USING (
    evaluator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- Evaluation Responses - Tied to evaluations access
ALTER TABLE public.evaluation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all evaluation responses" ON public.evaluation_responses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can read responses for own evaluations" ON public.evaluation_responses
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Evaluators can manage their evaluation responses" ON public.evaluation_responses
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- Evaluation Open Questions - Same pattern as responses
ALTER TABLE public.evaluation_open_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all open questions" ON public.evaluation_open_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can read open questions for own evaluations" ON public.evaluation_open_questions
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Evaluators can manage their open questions" ON public.evaluation_open_questions
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- Evaluation Objectives - Same pattern
ALTER TABLE public.evaluation_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all objectives" ON public.evaluation_objectives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can read objectives for own evaluations" ON public.evaluation_objectives
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Evaluators can manage their objectives" ON public.evaluation_objectives
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- Evaluation Recategorization - Same pattern
ALTER TABLE public.evaluation_recategorization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all recategorizations" ON public.evaluation_recategorization
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can read recategorization for own evaluations" ON public.evaluation_recategorization
  FOR SELECT USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Evaluators can manage their recategorizations" ON public.evaluation_recategorization
  FOR ALL USING (
    evaluation_id IN (
      SELECT id FROM public.evaluations 
      WHERE evaluator_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- =============================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================
-- Check views have security_invoker:
-- SELECT viewname, definition FROM pg_views WHERE schemaname = 'public' AND viewname IN ('leave_requests_with_details', 'employees_with_details', 'leave_balances_with_details');

-- Check RLS is enabled on tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- List all policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
