-- Add responsibilities column to jobs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'responsibilities'
  ) THEN
    ALTER TABLE public.jobs 
    ADD COLUMN responsibilities text;
  END IF;
END $$;

