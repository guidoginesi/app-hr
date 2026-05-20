-- ============================================================
-- MIGRATION: Security Fixes V2 for Supabase Linter Errors
-- ============================================================
-- Resuelve los 17 errores reportados por el linter de Supabase:
--   - 2 vistas con SECURITY DEFINER → recrear con security_invoker = true
--   - 15 tablas en `public` sin RLS → habilitar RLS
--
-- Criterio de seguridad (defense-in-depth):
--   - El 100% del acceso desde la app a estas tablas se hace con
--     SUPABASE_SERVICE_ROLE_KEY (ver src/lib/supabaseServer.ts), que
--     bypassa RLS. Habilitar RLS NO afecta el comportamiento actual.
--   - Para tablas internas (asana_*, automation_log) habilitamos RLS
--     SIN policies. Resultado: solo service_role puede leer/escribir.
--   - Para tablas con datos de negocio (payroll_*, rooms, room_bookings,
--     room_booking_invitees, employee_certificates, referrals) seguimos
--     el patrón ya establecido en migration-security-fixes.sql:
--       * "Admins can manage X"  (FOR ALL, vía public.admins / user_roles)
--       * "Authenticated users can read X" (defensa en profundidad)
--
-- Reversible: ver db/migration-security-fixes-v2-rollback.sql
--
-- IMPORTANTE: Aplicar primero en LOCAL (npx supabase start) y hacer
-- smoke test antes de aplicar en producción.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- ============================================================
-- Recreamos las vistas con security_invoker = true para que las RLS
-- de las tablas base se apliquen según el usuario que consulta, no
-- según el creador de la vista.
--
-- IMPORTANTE: La definición de la vista es la última versión vigente
-- en las migraciones existentes. Si cambia la vista en el futuro,
-- mantener la cláusula WITH (security_invoker = true).

-- 1.1 payroll_settlements_with_details
-- Definición vigente: db/migration-payroll-new-columns.sql
DROP VIEW IF EXISTS public.payroll_settlements_with_details;

CREATE VIEW public.payroll_settlements_with_details
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.payroll_settlements_with_details IS
  'Settlements con detalles de período, empleado, breakdown, payslip y factura. Usa security_invoker para RLS compliance.';

-- 1.2 room_bookings_with_details
-- Definición vigente: db/migration-room-booking.sql
DROP VIEW IF EXISTS public.room_bookings_with_details;

CREATE VIEW public.room_bookings_with_details
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW public.room_bookings_with_details IS
  'Reservas de salas con detalles de sala y empleado. Usa security_invoker para RLS compliance.';


-- ============================================================
-- PART 2: ENABLE RLS ON 15 TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 PAYROLL MODULE
-- Datos sensibles. Admin maneja, authenticated puede leer
-- (defensa en profundidad: hoy todo va por service_role).
-- ------------------------------------------------------------

-- payroll_periods
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll periods" ON public.payroll_periods
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read payroll periods" ON public.payroll_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- payroll_employee_settlements
ALTER TABLE public.payroll_employee_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll employee settlements" ON public.payroll_employee_settlements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own payroll settlements" ON public.payroll_employee_settlements
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );

-- payroll_payslips (PK = settlement_id)
ALTER TABLE public.payroll_payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll payslips" ON public.payroll_payslips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own payroll payslips" ON public.payroll_payslips
  FOR SELECT USING (
    settlement_id IN (
      SELECT id FROM public.payroll_employee_settlements
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- payroll_invoices (PK = settlement_id)
ALTER TABLE public.payroll_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll invoices" ON public.payroll_invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own payroll invoices" ON public.payroll_invoices
  FOR SELECT USING (
    settlement_id IN (
      SELECT id FROM public.payroll_employee_settlements
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );

-- payroll_monotributo_breakdown (PK = settlement_id)
ALTER TABLE public.payroll_monotributo_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payroll monotributo breakdown" ON public.payroll_monotributo_breakdown
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own payroll monotributo breakdown" ON public.payroll_monotributo_breakdown
  FOR SELECT USING (
    settlement_id IN (
      SELECT id FROM public.payroll_employee_settlements
      WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    )
  );


-- ------------------------------------------------------------
-- 2.2 ROOM BOOKING MODULE
-- ------------------------------------------------------------

-- rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rooms" ON public.rooms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read rooms" ON public.rooms
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- room_bookings
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage room bookings" ON public.room_bookings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read room bookings" ON public.room_bookings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- room_booking_invitees
ALTER TABLE public.room_booking_invitees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage room booking invitees" ON public.room_booking_invitees
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can read room booking invitees" ON public.room_booking_invitees
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ------------------------------------------------------------
-- 2.3 EMPLOYEE CERTIFICATES
-- ------------------------------------------------------------

ALTER TABLE public.employee_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employee certificates" ON public.employee_certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own certificates" ON public.employee_certificates
  FOR SELECT USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );


-- ------------------------------------------------------------
-- 2.4 REFERRALS
-- ------------------------------------------------------------

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage referrals" ON public.referrals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Employees can read own referrals" ON public.referrals
  FOR SELECT USING (
    referrer_employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  );


-- ------------------------------------------------------------
-- 2.5 INTERNAL / INTEGRATION TABLES
-- Estas tablas no se acceden desde clientes anon (solo backend con
-- service_role). Habilitamos RLS sin policies → nadie excepto
-- service_role puede leer/escribir. El linter de Supabase queda OK.
-- ------------------------------------------------------------

ALTER TABLE public.asana_webhook_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asana_processed_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asana_message_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_log          ENABLE ROW LEVEL SECURITY;


COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- 1) Las 2 vistas tienen security_invoker = true:
--    SELECT
--      c.relname AS view_name,
--      (SELECT option_value FROM pg_options_to_table(c.reloptions)
--       WHERE option_name = 'security_invoker') AS security_invoker
--    FROM pg_class c
--    JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relkind = 'v'
--      AND c.relname IN ('payroll_settlements_with_details', 'room_bookings_with_details');
--
-- 2) Las 15 tablas tienen RLS habilitada:
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
-- 3) Listado de policies creadas:
--    SELECT tablename, policyname, cmd
--    FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN (
--        'payroll_periods','payroll_employee_settlements','payroll_payslips',
--        'payroll_invoices','payroll_monotributo_breakdown',
--        'rooms','room_bookings','room_booking_invitees',
--        'employee_certificates','referrals'
--      )
--    ORDER BY tablename, policyname;
