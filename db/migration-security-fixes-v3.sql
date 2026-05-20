-- ============================================================
-- MIGRATION: Security Fixes V3 for Supabase Linter Warnings
-- ============================================================
-- Resuelve 11 de los 13 warnings reportados por el linter:
--   - 1 policy demasiado permisiva: time_off_email_logs (USING (true))
--   - 10 funciones con search_path mutable
--
-- Quedan FUERA de esta migración (resolverlos por separado):
--   - public_bucket_allows_listing (bucket employee-photos): requiere
--     verificar antes las policies activas en storage.objects.
--   - auth_leaked_password_protection: toggle en Supabase Dashboard
--     (Authentication → Policies → Password Settings).
--
-- Criterio:
--   - time_off_email_logs: replicar el patrón "Admins can manage" de
--     migration-security-fixes.sql / v2 (chequeo real contra
--     public.admins / user_roles). La app solo escribe acá vía
--     service_role (src/lib/emailService.ts), así que cerrar la policy
--     no afecta la funcionalidad.
--   - Funciones: ALTER FUNCTION ... SET search_path = public, pg_catalog;
--     No tocamos el cuerpo de ninguna función. El search_path queda
--     equivalente al default actual de Postgres en Supabase, pero
--     fijado a la función → el linter ya no lo marca como mutable.
--
-- Reversible: ver db/migration-security-fixes-v3-rollback.sql
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: FIX OVERLY PERMISSIVE POLICY ON time_off_email_logs
-- ============================================================
-- Estado actual (db/migration-time-off-emails.sql):
--   CREATE POLICY "Admins can manage time_off_email_logs"
--     FOR ALL TO authenticated USING (true);
-- Problema: cualquier usuario autenticado tiene acceso total.
-- Fix: chequeo real contra public.admins / public.user_roles, igual
-- al patrón ya usado en otras tablas administrativas.

-- RLS ya está habilitada por la migración original; este ALTER es
-- idempotente y queda como guardia.
ALTER TABLE public.time_off_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage time_off_email_logs" ON public.time_off_email_logs;

CREATE POLICY "Admins can manage time_off_email_logs" ON public.time_off_email_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );


-- ============================================================
-- PART 2: FIX MUTABLE search_path ON 10 FUNCTIONS
-- ============================================================
-- ALTER FUNCTION ... SET search_path no modifica el cuerpo de la
-- función — solo fija el parámetro de configuración. Mantiene el
-- comportamiento idéntico al actual y el linter ya no marca el warning.

-- 2.1 Trigger functions for updated_at
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_corporate_objectives_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_objectives_periods_updated_at()
  SET search_path = public, pg_catalog;

-- 2.2 Business / helper functions
ALTER FUNCTION public.is_user_leader(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.calculate_employee_objectives_score(uuid, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.is_objectives_period_open(integer, text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.calculate_vacation_days(date, date)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.validate_objective_weights(uuid, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.validate_sub_objectives(uuid)
  SET search_path = public, pg_catalog;


COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- 1) Policy de time_off_email_logs ya no es permisiva:
--    SELECT policyname, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename = 'time_off_email_logs';
--    -- qual y with_check deben referenciar public.admins / user_roles,
--    -- NO ser 'true'.
--
-- 2) Las 10 funciones tienen search_path fijado:
--    SELECT
--      n.nspname AS schema,
--      p.proname AS function_name,
--      pg_get_function_identity_arguments(p.oid) AS args,
--      p.proconfig AS config
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
--      )
--    ORDER BY p.proname;
--    -- proconfig debe contener {search_path=public, pg_catalog}
--    -- (no NULL, que es lo que indica search_path mutable).
