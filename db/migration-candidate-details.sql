-- Add phone to candidates table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'candidates' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.candidates 
    ADD COLUMN phone text;
    
    RAISE NOTICE '✅ Columna phone agregada a candidates';
  ELSE
    RAISE NOTICE '✅ Columna phone ya existe en candidates';
  END IF;
END $$;

-- Add salary_expectation and english_level to applications table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'salary_expectation'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN salary_expectation text;
    
    RAISE NOTICE '✅ Columna salary_expectation agregada a applications';
  ELSE
    RAISE NOTICE '✅ Columna salary_expectation ya existe en applications';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'english_level'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN english_level text;
    
    RAISE NOTICE '✅ Columna english_level agregada a applications';
  ELSE
    RAISE NOTICE '✅ Columna english_level ya existe en applications';
  END IF;
END $$;

-- Verify columns were created
SELECT 
  'candidates' as table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'candidates' 
  AND column_name = 'phone'
UNION ALL
SELECT 
  'applications' as table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'applications' 
  AND column_name IN ('salary_expectation', 'english_level');

