-- ============================================================
-- MIGRATION: Security Fixes V4 — Storage (employee-photos bucket)
-- ============================================================
-- Resuelve el warning `public_bucket_allows_listing` para el bucket
-- `employee-photos`.
--
-- Contexto:
--   - El bucket está marcado como public = true (verificado).
--   - El código solo usa .upload() y .getPublicUrl() (verificado en
--     src/app/admin/people/EmployeeFormModal.tsx).
--   - Las URLs públicas (servidas por el CDN de Supabase) NO necesitan
--     policy SELECT mientras bucket.public = true. La policy SELECT
--     solo se usa para .list() y .download() vía SDK, que nadie usa.
--
-- Fix:
--   - DROP de la policy "Allow public read" sobre storage.objects.
--   - Las otras 3 policies (uploads/updates/deletes para authenticated)
--     se mantienen intactas — el flujo de admin sigue funcionando.
--
-- Reversible: ver db/migration-security-fixes-v4-rollback.sql
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- Deben quedar 3 policies sobre employee-photos (INSERT/UPDATE/DELETE),
-- no 4:
--   SELECT policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'storage'
--     AND tablename = 'objects'
--     AND (qual::text LIKE '%employee-photos%' OR with_check::text LIKE '%employee-photos%');
--
-- Smoke test en la app: cargar páginas que muestran fotos de empleados:
--   - /portal/team
--   - /admin/people
--   - /admin/people/organigrama
-- Las fotos deben renderizarse normalmente.
