-- Migration: Offboarding Module
-- Run this in the Supabase SQL Editor
-- Date: 2026-02-04

-- =============================================
-- 1. Create enum for termination reason
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'termination_reason') THEN
    CREATE TYPE termination_reason AS ENUM ('resignation', 'dismissal');
  END IF;
END $$;

-- =============================================
-- 2. Add columns to employees table
-- =============================================

-- Add termination_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'termination_reason'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN termination_reason termination_reason;
  END IF;
END $$;

-- Add termination_notes column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'termination_notes'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN termination_notes TEXT;
  END IF;
END $$;

-- Add terminated_by_user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'terminated_by_user_id'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN terminated_by_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add offboarding_enabled column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'offboarding_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN offboarding_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add offboarding_completed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'employees' 
    AND column_name = 'offboarding_completed_at'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN offboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================
-- 3. Create offboarding_responses table
-- =============================================
CREATE TABLE IF NOT EXISTS public.offboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offboarding_responses_employee ON public.offboarding_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_responses_status ON public.offboarding_responses(status);

-- =============================================
-- 4. Enable RLS on offboarding_responses
-- =============================================
ALTER TABLE public.offboarding_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read their own responses
DROP POLICY IF EXISTS "Users can read own offboarding responses" ON public.offboarding_responses;
CREATE POLICY "Users can read own offboarding responses" ON public.offboarding_responses
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Allow authenticated users to update their own responses
DROP POLICY IF EXISTS "Users can update own offboarding responses" ON public.offboarding_responses;
CREATE POLICY "Users can update own offboarding responses" ON public.offboarding_responses
  FOR UPDATE
  USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE user_id = auth.uid()
    )
  );

-- Policy: Service role can do everything
DROP POLICY IF EXISTS "Service role full access to offboarding_responses" ON public.offboarding_responses;
CREATE POLICY "Service role full access to offboarding_responses" ON public.offboarding_responses
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- 5. Verification
-- =============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Offboarding migration completed successfully';
  RAISE NOTICE '========================================';
END $$;

-- Show new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'employees'
  AND column_name IN ('termination_reason', 'termination_notes', 'terminated_by_user_id', 'offboarding_enabled', 'offboarding_completed_at')
ORDER BY column_name;

-- Show offboarding_responses table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'offboarding_responses'
ORDER BY ordinal_position;
