-- Respuesta "Voy / No voy" de un mensaje de Comunicaciones (metadata.rsvp).
-- Se responde con un link firmado desde el mail, sin iniciar sesión
-- (/rsvp → POST /api/rsvp). Sólo se actualiza la fila del destinatario.
alter table public.message_recipients
  add column if not exists rsvp_response text check (rsvp_response in ('yes', 'no')),
  add column if not exists rsvp_at timestamptz;
