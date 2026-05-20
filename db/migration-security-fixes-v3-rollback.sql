-- ============================================================
-- ROLLBACK: Security Fixes V3
-- ============================================================
-- Revierte por completo db/migration-security-fixes-v3.sql:
--   - Restaura la policy original de time_off_email_logs (USING (true))
--   - Resetea el search_path de las 10 funciones a su estado mutable
--
-- IMPORTANTE: tras correr este rollback, los 11 warnings vuelven al
-- linter de Supabase (1 RLS permisiva + 10 search_path mutable). Es
-- esperado.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: RESET search_path ON 10 FUNCTIONS
-- ============================================================
-- ALTER FUNCTION ... RESET search_path elimina el seteo y vuelve al
-- comportamiento por default (= mutable, como estaba antes de v3).

ALTER FUNCTION public.validate_sub_objectives(uuid)                         RESET search_path;
ALTER FUNCTION public.validate_objective_weights(uuid, integer)             RESET search_path;
ALTER FUNCTION public.calculate_vacation_days(date, date)                   RESET search_path;
ALTER FUNCTION public.is_objectives_period_open(integer, text)              RESET search_path;
ALTER FUNCTION public.calculate_employee_objectives_score(uuid, integer)    RESET search_path;
ALTER FUNCTION public.is_user_leader(uuid)                                  RESET search_path;
ALTER FUNCTION public.update_objectives_periods_updated_at()                RESET search_path;
ALTER FUNCTION public.update_corporate_objectives_updated_at()              RESET search_path;
ALTER FUNCTION public.set_updated_at()                                      RESET search_path;
ALTER FUNCTION public.update_updated_at_column()                            RESET search_path;


-- ============================================================
-- PART 2: RESTORE PERMISSIVE POLICY ON time_off_email_logs
-- ============================================================
-- Recreamos la policy con la definición exacta de
-- db/migration-time-off-emails.sql (línea 27-31), para volver al
-- estado anterior a v3.

DROP POLICY IF EXISTS "Admins can manage time_off_email_logs" ON public.time_off_email_logs;

CREATE POLICY "Admins can manage time_off_email_logs" ON public.time_off_email_logs
  FOR ALL
  TO authenticated
  USING (true);


COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- 1) Policy de time_off_email_logs vuelve a ser permisiva:
--    SELECT policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'time_off_email_logs';
--    -- qual debe ser 'true'.
--
-- 2) Las 10 funciones ya no tienen search_path fijado:
--    SELECT proname, proconfig
--    FROM pg_proc p
--    JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND p.proname IN (
--        'update_updated_at_column','set_updated_at',
--        'update_corporate_objectives_updated_at',
--        'update_objectives_periods_updated_at',
--        'is_user_leader','calculate_employee_objectives_score',
--        'is_objectives_period_open','calculate_vacation_days',
--        'validate_objective_weights','validate_sub_objectives'
--      );
--    -- proconfig debe ser NULL (= mutable, como antes de v3).
