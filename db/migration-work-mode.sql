-- Add work_mode column to jobs table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'jobs' 
    AND column_name = 'work_mode'
  ) THEN
    ALTER TABLE public.jobs 
    ADD COLUMN work_mode text CHECK (work_mode IN ('Remota', 'Híbrida', 'Presencial')) DEFAULT 'Remota';
  END IF;
END $$;

