-- Respuesta con opciones a un mensaje de Comunicaciones (metadata.email.rsvp.questions):
-- una o más preguntas, cada una con sus opciones ("¿Cuándo llegás?" → Martes / Miércoles).
-- Se guarda { "<índice de pregunta>": <índice de opción> } por destinatario.
-- rsvp_response sigue sirviendo para los mensajes de "Voy / No voy".
alter table public.message_recipients
  add column if not exists rsvp_answers jsonb;
