-- Migration: Two-Level Approval Workflow for Leave Requests
-- Implements Leader → HR approval flow

-- ==========================================
-- 1. Add New Status Values to Enum
-- ==========================================
-- Note: PostgreSQL doesn't allow removing enum values, so we keep old ones for backward compatibility
-- New flow: pending_leader → pending_hr → approved (or rejected_leader/rejected_hr)

ALTER TYPE leave_request_status ADD VALUE IF NOT EXISTS 'pending_leader';
ALTER TYPE leave_request_status ADD VALUE IF NOT EXISTS 'pending_hr';
ALTER TYPE leave_request_status ADD VALUE IF NOT EXISTS 'rejected_leader';
ALTER TYPE leave_request_status ADD VALUE IF NOT EXISTS 'rejected_hr';

-- ==========================================
-- 2. Add New Columns for Two-Level Tracking
-- ==========================================

-- Leader tracking columns
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS leader_approved_at TIMESTAMPTZ;

ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS leader_rejection_reason TEXT;

-- HR tracking columns
ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS hr_approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMPTZ;

ALTER TABLE public.leave_requests 
ADD COLUMN IF NOT EXISTS hr_rejection_reason TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_leave_requests_leader_id ON public.leave_requests(leader_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_hr_approved_by ON public.leave_requests(hr_approved_by);

-- ==========================================
-- 3. Migrate Existing Data
-- ==========================================

-- Migrate 'pending' status to 'pending_leader' and set leader_id from employee's manager
UPDATE public.leave_requests lr
SET 
  status = 'pending_leader',
  leader_id = e.manager_id
FROM public.employees e
WHERE lr.employee_id = e.id
  AND lr.status = 'pending'
  AND e.manager_id IS NOT NULL;

-- For approved requests, set leader tracking fields from approved_by
UPDATE public.leave_requests
SET 
  leader_id = approved_by,
  leader_approved_at = approved_at,
  hr_approved_by = approved_by,
  hr_approved_at = approved_at
WHERE status = 'approved' 
  AND approved_by IS NOT NULL;

-- For rejected requests, migrate to rejected_leader and set leader rejection reason
UPDATE public.leave_requests
SET 
  status = 'rejected_leader',
  leader_id = approved_by,
  leader_rejection_reason = rejection_reason
WHERE status = 'rejected'
  AND approved_by IS NOT NULL;

-- ==========================================
-- 4. Update View with New Fields
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
  CONCAT(a.first_name, ' ', a.last_name) AS approver_name,
  -- New fields for two-level approval
  CONCAT(l.first_name, ' ', l.last_name) AS leader_name,
  CONCAT(hr.first_name, ' ', hr.last_name) AS hr_approver_name
FROM public.leave_requests lr
JOIN public.leave_types lt ON lr.leave_type_id = lt.id
JOIN public.employees e ON lr.employee_id = e.id
LEFT JOIN public.employees m ON e.manager_id = m.id
LEFT JOIN public.employees a ON lr.approved_by = a.id
LEFT JOIN public.employees l ON lr.leader_id = l.id
LEFT JOIN public.employees hr ON lr.hr_approved_by = hr.id;

-- ==========================================
-- 5. Update RLS Policies for New Status Values
-- ==========================================

-- Drop and recreate policy for employees updating their own requests
DROP POLICY IF EXISTS "Employees can update own pending requests" ON public.leave_requests;

CREATE POLICY "Employees can update own pending requests" ON public.leave_requests
  FOR UPDATE USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    AND status IN ('pending', 'pending_leader', 'pending_hr')
  );
