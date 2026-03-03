-- ============================================================
-- Fix: room_bookings stored with wrong UTC offset
-- Before this fix, times sent from the client had no timezone info
-- and were stored as UTC instead of Argentina time (UTC-3).
-- A booking at 10:00 Argentina was stored as 10:00 UTC (= 07:00 AR).
-- This script adds +3 hours to all existing confirmed/pending bookings.
-- ============================================================

-- PASO 1: Verificar las reservas actuales
SELECT
  rb.id,
  e.first_name || ' ' || e.last_name AS empleado,
  r.name AS sala,
  rb.start_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS inicio_ar,
  rb.end_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS fin_ar,
  rb.status
FROM room_bookings rb
JOIN employees e ON e.id = rb.employee_id
JOIN rooms r ON r.id = rb.room_id
WHERE rb.status IN ('confirmed', 'pending')
  AND rb.start_at > now() - interval '30 days'
ORDER BY rb.start_at;

-- ============================================================
-- PASO 2: Corregir agregando 3 horas a todos los que están mal
-- Solo ejecutar si el PASO 1 muestra horas incorrectas (3hs menos).
-- Afecta SOLO reservas activas (no canceladas) de los últimos 30 días
-- y futuras.
-- ============================================================

UPDATE room_bookings
SET
  start_at   = start_at + interval '3 hours',
  end_at     = end_at   + interval '3 hours',
  updated_at = now()
WHERE status IN ('confirmed', 'pending')
  AND start_at > now() - interval '30 days';

-- PASO 3: Verificar que quedaron bien
SELECT
  rb.id,
  e.first_name || ' ' || e.last_name AS empleado,
  r.name AS sala,
  rb.start_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS inicio_ar,
  rb.end_at AT TIME ZONE 'America/Argentina/Buenos_Aires' AS fin_ar,
  rb.status
FROM room_bookings rb
JOIN employees e ON e.id = rb.employee_id
JOIN rooms r ON r.id = rb.room_id
WHERE rb.status IN ('confirmed', 'pending')
  AND rb.start_at > now() - interval '30 days'
ORDER BY rb.start_at;
