-- Migration: Trabajo fuera de domicilio habitual (días sueltos / viajes)
-- Notificación obligatoria a ART y seguro. No consume balance (ilimitada).

INSERT INTO public.leave_types (
  code,
  name,
  description,
  requires_attachment,
  advance_notice_days,
  count_type,
  is_accumulative,
  is_active
) VALUES (
  'remote_work_trip',
  'Trabajo fuera de domicilio habitual',
  'Notificación a ART y seguro cuando trabajás fuera de tu domicilio habitual por días sueltos o viajes (no semanas completas).',
  false,
  0,
  'business_days',
  false,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  requires_attachment = EXCLUDED.requires_attachment,
  advance_notice_days = EXCLUDED.advance_notice_days,
  count_type = EXCLUDED.count_type,
  is_accumulative = EXCLUDED.is_accumulative,
  is_active = EXCLUDED.is_active;
