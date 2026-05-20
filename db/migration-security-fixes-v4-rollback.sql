-- ============================================================
-- ROLLBACK: Security Fixes V4 — Storage (employee-photos bucket)
-- ============================================================
-- Recrea la policy "Allow public read" sobre storage.objects para el
-- bucket employee-photos, exactamente como estaba antes de v4.
--
-- IMPORTANTE: tras correr este rollback, vuelve el warning
-- public_bucket_allows_listing en el linter de Supabase. Es esperado.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

CREATE POLICY "Allow public read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'employee-photos');

COMMIT;


-- ============================================================
-- VERIFICATION (correr DESPUÉS del COMMIT)
-- ============================================================
-- Deben quedar 4 policies sobre employee-photos:
--   SELECT policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'storage'
--     AND tablename = 'objects'
--     AND (qual::text LIKE '%employee-photos%' OR with_check::text LIKE '%employee-photos%');
