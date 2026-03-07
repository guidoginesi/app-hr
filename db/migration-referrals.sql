-- Migration: Employee Referrals Module
CREATE TABLE IF NOT EXISTS public.referrals (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  job_id                uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_name        text NOT NULL,
  candidate_email       text NOT NULL,
  candidate_phone       text,
  candidate_linkedin    text,
  recommendation_reason text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_process', 'hired', 'rejected', 'closed')),
  bonus_paid            boolean NOT NULL DEFAULT false,
  hr_notes              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_employee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_job ON public.referrals(job_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
