-- Edición de mensajes de una consulta, con rastro
--
-- Editar en silencio un mensaje ya enviado es peor que no poder editarlo: el
-- hilo puede terminar diciendo algo distinto de lo que la persona leyó, y nadie
-- lo puede reconstruir después. Por eso la edición deja marca visible para las
-- dos partes y guarda la versión anterior.

alter table public.inquiry_messages
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references auth.users(id) on delete set null;

comment on column public.inquiry_messages.edited_at is
  'Marca visible en el hilo, también del lado del colaborador. Si se editó, se dice.';

-- El historial: qué decía antes de cada edición.
create table if not exists public.inquiry_message_edits (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references public.inquiry_messages(id) on delete cascade,
  -- El cuerpo ANTERIOR a esta edición. La versión vigente vive en el mensaje.
  body_anterior text not null,
  editado_por   uuid references auth.users(id) on delete set null,
  creado_at     timestamptz not null default now()
);

create index if not exists idx_inquiry_message_edits_mensaje
  on public.inquiry_message_edits(message_id, creado_at desc);

alter table public.inquiry_message_edits enable row level security;

-- Sin policies para clientes: el historial se sirve desde rutas de servidor con
-- requireAdmin. Al colaborador le corresponde ver QUE se editó, no las versiones
-- viejas.
