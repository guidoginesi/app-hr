-- ============================================================
-- ROLLBACK: Security Fixes V2
-- ============================================================
-- Revierte por completo db/migration-security-fixes-v2.sql:
--   - DROP de todas las policies creadas
--   - DISABLE RLS en las 15 tablas
--   - Recreación de las 2 vistas SIN security_invoker (estado anterior)
--
-- Si ya está aplicada la migración v2 y necesitás volver atrás, ejecutar
-- este archivo completo. Es idempotente (usa IF EXISTS / DROP POLICY IF
-- EXISTS) por si algún paso de la migración v2 no llegó a aplicarse.
--
-- IMPORTANTE: tras correr este rollback, los 17 errores del linter de
-- Supabase volverán a aparecer — es esperado.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: DROP POLICIES + DISABLE RLS (orden inverso a la migración)
-- ============================================================

-- 1.5 Internal / Integration tables (no tenían policies, solo RLS)
ALTER TABLE IF EXISTS public.automation_log          DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asana_message_log       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asana_processed_stories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asana_webhook_config    DISABLE ROW LEVEL SECURITY;

-- 1.4 Referrals
DROP POLICY IF EXISTS "Employees can read own referrals"  ON public.referrals;
DROP POLICY IF EXISTS "Admins can manage referrals"       ON public.referrals;
ALTER TABLE IF EXISTS public.referrals DISABLE ROW LEVEL SECURITY;

-- 1.3 Employee certificates
DROP POLICY IF EXISTS "Employees can read own certificates"     ON public.employee_certificates;
DROP POLICY IF EXISTS "Admins can manage employee certificates" ON public.employee_certificates;
ALTER TABLE IF EXISTS public.employee_certificates DISABLE ROW LEVEL SECURITY;

-- 1.2 Room booking module
DROP POLICY IF EXISTS "Authenticated users can read room booking invitees" ON public.room_booking_invitees;
DROP POLICY IF EXISTS "Admins can manage room booking invitees"            ON public.room_booking_invitees;
ALTER TABLE IF EXISTS public.room_booking_invitees DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read room bookings" ON public.room_bookings;
DROP POLICY IF EXISTS "Admins can manage room bookings"            ON public.room_bookings;
ALTER TABLE IF EXISTS public.room_bookings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admins can manage rooms"            ON public.rooms;
ALTER TABLE IF EXISTS public.rooms DISABLE ROW LEVEL SECURITY;

-- 1.1 Payroll module
DROP POLICY IF EXISTS "Employees can read own payroll monotributo breakdown" ON public.payroll_monotributo_breakdown;
DROP POLICY IF EXISTS "Admins can manage payroll monotributo breakdown"      ON public.payroll_monotributo_breakdown;
ALTER TABLE IF EXISTS public.payroll_monotributo_breakdown DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can read own payroll invoices" ON public.payroll_invoices;
DROP POLICY IF EXISTS "Admins can manage payroll invoices"      ON public.payroll_invoices;
ALTER TABLE IF EXISTS public.payroll_invoices DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can read own payroll payslips" ON public.payroll_payslips;
DROP POLICY IF EXISTS "Admins can manage payroll payslips"      ON public.payroll_payslips;
ALTER TABLE IF EXISTS public.payroll_payslips DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can read own payroll settlements"   ON public.payroll_employee_settlements;
DROP POLICY IF EXISTS "Admins can manage payroll employee settlements" ON public.payroll_employee_settlements;
ALTER TABLE IF EXISTS public.payroll_employee_settlements DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payroll periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Admins can manage payroll periods"            ON public.payroll_periods;
ALTER TABLE IF EXISTS public.payroll_periods DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 2: RESTORE VIEWS WITHOUT security_invoker
-- ============================================================
-- Recreamos las vistas con la definición canónica anterior, SIN la
-- cláusula WITH (security_invoker = true), para volver al estado
-- previo a la migración v2 (Postgres usa SECURITY DEFINER por default).

-- 2.1 payroll_settlements_with_details (sin security_invoker)
-- Definición canónica: db/migration-payroll-new-columns.sql
DROP VIEW IF EXISTS public.payroll_settlements_with_details;

CREATE VIEW public.payroll_settlements_with_details AS
SELECT
  s.*,
  p.year                                          AS period_year,
  p.month                                         AS period_month,
  p.period_key,
  p.status                                        AS period_status,
  e.user_id                                       AS employee_user_id,
  e.first_name,
  e.last_name,
  COALESCE(e.work_email, e.personal_email)        AS employee_email,
  e.employment_type                               AS current_employment_type,
  mb.sueldo,
  mb.monotributo,
  mb.reintegro_internet,
  mb.reintegro_extraordinario,
  mb.plus_vacacional,
  mb.bonificacion_anual,
  mb.aguinaldo,
  mb.adelanto_sueldo,
  mb.total_a_facturar,
  ps.pdf_storage_path,
  ps.pdf_filename,
  ps.pdf_uploaded_at,
  inv.pdf_storage_path                            AS invoice_storage_path,
  inv.pdf_filename                                AS invoice_filename,
  inv.uploaded_at                                 AS invoice_uploaded_at
FROM public.payroll_employee_settlements s
JOIN public.payroll_periods p              ON p.id  = s.period_id
JOIN public.employees e                    ON e.id  = s.employee_id
LEFT JOIN public.payroll_monotributo_breakdown mb ON mb.settlement_id = s.id
LEFT JOIN public.payroll_payslips ps              ON ps.settlement_id = s.id
LEFT JOIN public.payroll_invoices inv             ON inv.settlement_id = s.id;

-- 2.2 room_bookings_with_details (sin security_invoker)
-- Definición canónica: db/migration-room-booking.sql
DROP VIEW IF EXISTS public.room_bookings_with_details;

CREATE VIEW public.room_bookings_with_details AS
SELECT
  rb.*,
  r.name      AS room_name,
  r.location  AS room_location,
  r.capacity  AS room_capacity,
  r.equipment AS room_equipment,
  e.first_name AS employee_first_name,
  e.last_name  AS employee_last_name,
  e.work_email AS employee_email
FROM public.room_bookings rb
JOIN public.rooms r     ON r.id = rb.room_id
JOIN public.employees e ON e.id = rb.employee_id;


COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- 1) Ninguna de las 15 tablas debe tener RLS activa:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'payroll_periods','payroll_employee_settlements','payroll_payslips',
--        'payroll_invoices','payroll_monotributo_breakdown',
--        'rooms','room_bookings','room_booking_invitees',
--        'employee_certificates','referrals',
--        'asana_webhook_config','asana_processed_stories','asana_message_log',
--        'automation_log'
--      )
--    ORDER BY tablename;
--
-- 2) Ninguna policy debe quedar en esas tablas:
--    SELECT tablename, policyname
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'payroll_periods','payroll_employee_settlements','payroll_payslips',
--        'payroll_invoices','payroll_monotributo_breakdown',
--        'rooms','room_bookings','room_booking_invitees',
--        'employee_certificates','referrals'
--      );
--
-- 3) Las 2 vistas NO deben tener security_invoker en reloptions:
--    SELECT relname, reloptions
--    FROM pg_class
--    WHERE relkind = 'v'
--      AND relname IN ('payroll_settlements_with_details','room_bookings_with_details');
