-- ============================================================
-- MIGRATION: Room Booking Module (Reserva de Salas)
-- Ported from pow-room-buddy into app-hr
-- ============================================================

-- Rooms table (aligned with original pow-room-buddy schema)
CREATE TABLE IF NOT EXISTS public.rooms (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text NOT NULL,
  capacity     int NOT NULL DEFAULT 1,
  location     text,
  description  text,
  equipment    text,
  status       text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'disabled')),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Room bookings table (reservations)
CREATE TABLE IF NOT EXISTS public.room_bookings (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id                uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  employee_id            uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title                  text NOT NULL,
  start_at               timestamptz NOT NULL,
  end_at                 timestamptz NOT NULL,
  status                 text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  notes                  text,
  recurrence_type        text CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
  recurrence_end_date    timestamptz,
  parent_booking_id      uuid REFERENCES public.room_bookings(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_end_after_start CHECK (end_at > start_at)
);

CREATE TRIGGER update_room_bookings_updated_at
  BEFORE UPDATE ON public.room_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Booking invitees
CREATE TABLE IF NOT EXISTS public.room_booking_invitees (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id       uuid NOT NULL REFERENCES public.room_bookings(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, employee_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_room_bookings_room_id ON public.room_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_employee_id ON public.room_bookings(employee_id);
CREATE INDEX IF NOT EXISTS idx_room_bookings_start_at ON public.room_bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_room_bookings_status ON public.room_bookings(status);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_room_booking_invitees_booking ON public.room_booking_invitees(booking_id);
CREATE INDEX IF NOT EXISTS idx_room_booking_invitees_employee ON public.room_booking_invitees(employee_id);

-- View with details
CREATE OR REPLACE VIEW public.room_bookings_with_details AS
SELECT
  rb.*,
  r.name AS room_name,
  r.location AS room_location,
  r.capacity AS room_capacity,
  r.equipment AS room_equipment,
  e.first_name AS employee_first_name,
  e.last_name AS employee_last_name,
  e.work_email AS employee_email
FROM public.room_bookings rb
JOIN public.rooms r ON r.id = rb.room_id
JOIN public.employees e ON e.id = rb.employee_id;
