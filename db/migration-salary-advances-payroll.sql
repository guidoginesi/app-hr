-- Migration: integración Adelantos ↔ Liquidación (Fase 3)
-- ---------------------------------------------------------------
-- Vincula un adelanto al período de liquidación que lo descuenta.
-- El monto se aplica al crear el período (pull por mes); al cerrar el período
-- el adelanto se marca saldado. Monotributo: descuento computado en
-- adelanto_sueldo. Dependencia: descuento informado (el recibo es PDF).

ALTER TABLE public.salary_advances
  ADD COLUMN IF NOT EXISTS applied_period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_salary_advances_applied_period ON public.salary_advances(applied_period_id);

-- La vista usa sa.* (congelado a la creación), así que hay que recrearla para
-- que exponga la nueva columna applied_period_id.
DROP VIEW IF EXISTS public.salary_advances_with_details;
CREATE VIEW public.salary_advances_with_details
WITH (security_invoker = true) AS
  SELECT sa.*,
    concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.employment_type,
    e.hire_date,
    e.status AS employee_status,
    e.user_id AS employee_user_id,
    coalesce(e.work_email, e.personal_email) AS employee_email
  FROM public.salary_advances sa
  JOIN public.employees e ON sa.employee_id = e.id;
