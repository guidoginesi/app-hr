-- Migration: allow recategorization notes without a linked evaluation
-- This lets leaders leave HR notes even before the evaluation process is complete.

-- 1. Remove NOT NULL from evaluation_id
ALTER TABLE public.evaluation_recategorization
  ALTER COLUMN evaluation_id DROP NOT NULL;

-- 2. Add employee_id to link the record to an employee when there's no evaluation
ALTER TABLE public.evaluation_recategorization
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE;

-- 3. Add period_id to link the record to the active period when there's no evaluation
ALTER TABLE public.evaluation_recategorization
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES public.evaluation_periods(id) ON DELETE CASCADE;

-- 4. Back-fill employee_id and period_id from the linked evaluation for existing records
UPDATE public.evaluation_recategorization r
SET
  employee_id = e.employee_id,
  period_id   = e.period_id
FROM public.evaluations e
WHERE r.evaluation_id = e.id
  AND r.employee_id IS NULL;

-- 5. Partial unique index: one note per employee per period when there is no evaluation
CREATE UNIQUE INDEX IF NOT EXISTS evaluation_recategorization_employee_period_no_eval_idx
  ON public.evaluation_recategorization (employee_id, period_id)
  WHERE evaluation_id IS NULL;

-- 6. Enforce that every row has either evaluation_id OR (employee_id + period_id)
ALTER TABLE public.evaluation_recategorization
  DROP CONSTRAINT IF EXISTS evaluation_recategorization_has_reference;
ALTER TABLE public.evaluation_recategorization
  ADD CONSTRAINT evaluation_recategorization_has_reference
  CHECK (
    evaluation_id IS NOT NULL
    OR (employee_id IS NOT NULL AND period_id IS NOT NULL)
  );
