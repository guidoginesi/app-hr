-- Agregar columna provincia a la tabla candidates
-- Opciones: CABA, GBA, OTRA

-- Crear tipo enum para provincia
DO $$ BEGIN
  CREATE TYPE provincia AS ENUM ('CABA', 'GBA', 'OTRA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Agregar columna provincia a candidates (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidates' AND column_name = 'provincia'
  ) THEN
    ALTER TABLE public.candidates ADD COLUMN provincia provincia;
  END IF;
END $$;

-- Agregar índice para consultas por provincia
CREATE INDEX IF NOT EXISTS idx_candidates_provincia ON public.candidates(provincia);

