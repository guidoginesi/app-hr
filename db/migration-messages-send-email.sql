-- Mensajes: opción de enviar también por mail al publicar (opt-in por mensaje).
-- Espeja send_to_google_chat. Lo consume /api/admin/messages/[id]/publish.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS send_email boolean NOT NULL DEFAULT false;
