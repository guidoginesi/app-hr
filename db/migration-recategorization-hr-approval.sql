-- Migration: Add HR approval fields to evaluation_recategorization
-- This allows HR to approve or reject recategorization proposals from leaders

-- Add hr_status column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evaluation_recategorization' 
    AND column_name = 'hr_status'
  ) THEN
    ALTER TABLE public.evaluation_recategorization
    ADD COLUMN hr_status VARCHAR(20) DEFAULT 'pending';
  END IF;
END $$;

-- Add hr_notes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evaluation_recategorization' 
    AND column_name = 'hr_notes'
  ) THEN
    ALTER TABLE public.evaluation_recategorization
    ADD COLUMN hr_notes TEXT;
  END IF;
END $$;

-- Add check constraint for valid hr_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'evaluation_recategorization_hr_status_check'
  ) THEN
    ALTER TABLE public.evaluation_recategorization
    ADD CONSTRAINT evaluation_recategorization_hr_status_check 
    CHECK (hr_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Create index for filtering by hr_status
CREATE INDEX IF NOT EXISTS idx_evaluation_recategorization_hr_status 
ON public.evaluation_recategorization(hr_status);
