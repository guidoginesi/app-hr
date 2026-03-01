-- ============================================================
-- MIGRATION: Add biweekly recurrence type to room_bookings
-- ============================================================

-- Drop the existing inline check constraint and re-add with biweekly
ALTER TABLE public.room_bookings
  DROP CONSTRAINT IF EXISTS room_bookings_recurrence_type_check;

ALTER TABLE public.room_bookings
  ADD CONSTRAINT room_bookings_recurrence_type_check
  CHECK (recurrence_type IN ('daily', 'weekly', 'biweekly', 'monthly'));
