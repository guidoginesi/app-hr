-- Migration: log de notificaciones ART Teletrabajo (evita envíos duplicados)

CREATE TABLE IF NOT EXISTS public.art_teletrabajo_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('pre_departure', 'post_return')),
  trigger_date DATE NOT NULL,
  roster_date DATE NOT NULL,
  leave_request_ids UUID[] NOT NULL DEFAULT '{}',
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  employee_count INT NOT NULL DEFAULT 0,
  resend_ids TEXT[] DEFAULT '{}',
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_type, trigger_date)
);

CREATE INDEX IF NOT EXISTS idx_art_teletrabajo_notifications_trigger_date
  ON public.art_teletrabajo_notifications (trigger_date DESC);

COMMENT ON TABLE public.art_teletrabajo_notifications IS
  'Registro de envíos del PDF Teletrabajo Berkley ART (cron diario).';

ALTER TABLE public.art_teletrabajo_notifications ENABLE ROW LEVEL SECURITY;
