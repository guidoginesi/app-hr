-- ============================================
-- MIGRACIÓN: Funnel de Selección
-- ============================================
-- Este script agrega el nuevo modelo de funnel sin afectar datos existentes
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Crear enums (si no existen)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage') THEN
    CREATE TYPE stage as enum (
      'CV_RECEIVED',
      'HR_REVIEW',
      'FILTER_QUESTIONS',
      'HR_INTERVIEW',
      'LEAD_INTERVIEW',
      'EO_INTERVIEW',
      'REFERENCES_CHECK',
      'SELECTED_FOR_OFFER',
      'OFFER',
      'CLOSED'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_status') THEN
    CREATE TYPE stage_status as enum (
      'PENDING',
      'IN_PROGRESS',
      'COMPLETED',
      'DISCARDED_IN_STAGE',
      'ON_HOLD'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE offer_status as enum (
      'PENDING_TO_SEND',
      'SENT',
      'ACCEPTED',
      'REJECTED_BY_CANDIDATE',
      'WITHDRAWN_BY_POW',
      'EXPIRED'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'final_outcome') THEN
    CREATE TYPE final_outcome as enum (
      'HIRED',
      'REJECTED_BY_POW',
      'REJECTED_BY_CANDIDATE',
      'ROLE_CANCELLED',
      'TALENT_POOL'
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rejection_reason') THEN
    CREATE TYPE rejection_reason as enum (
      'TECH_SKILLS_INSUFFICIENT',
      'CULTURAL_MISFIT',
      'SALARY_EXPECTATION_ABOVE_RANGE',
      'LACK_OF_EXPERIENCE',
      'SOFT_SKILLS_MISMATCH',
      'NO_SHOW',
      'ACCEPTED_OTHER_OFFER',
      'SALARY_TOO_LOW',
      'BENEFITS_INSUFFICIENT',
      'MODALITY_NOT_ACCEPTED',
      'LOCATION_ISSUE',
      'PERSONAL_REASON',
      'PROCESS_TAKES_TOO_LONG',
      'OTHER'
    );
  END IF;
END $$;

-- 2. Agregar columnas nuevas a applications (si no existen)
DO $$ 
BEGIN
  -- current_stage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'current_stage'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN current_stage stage NOT NULL DEFAULT 'CV_RECEIVED';
  END IF;

  -- current_stage_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'current_stage_status'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN current_stage_status stage_status NOT NULL DEFAULT 'PENDING';
  END IF;

  -- offer_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'offer_status'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN offer_status offer_status;
  END IF;

  -- final_outcome
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'final_outcome'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN final_outcome final_outcome;
  END IF;

  -- final_rejection_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'final_rejection_reason'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN final_rejection_reason rejection_reason;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3. Crear tabla stage_history (si no existe)
CREATE TABLE IF NOT EXISTS public.stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage stage,
  to_stage stage not null,
  status stage_status not null,
  changed_by_user_id uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  notes text
);

-- 4. Crear índices (si no existen)
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON public.applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_applications_stage_status ON public.applications(current_stage_status);
CREATE INDEX IF NOT EXISTS idx_stage_history_application ON public.stage_history(application_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON public.stage_history(changed_at);

-- 5. Crear función y trigger para updated_at (si no existe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger as $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

DROP TRIGGER IF EXISTS update_applications_updated_at ON public.applications;
CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ✅ Migración completada
-- ============================================
-- Ahora podés ejecutar el script de migración de datos:
-- node scripts/migrate-applications-to-funnel.mjs
-- ============================================

