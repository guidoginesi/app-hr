-- Propuestas de respuesta a consultas, armadas con el Manual RRHH
--
-- Guarda qué propuso el agente y —lo que más importa— qué hizo HR con eso.
-- La calificación no se pide en una pantalla aparte: sale del propio flujo de
-- responder, que es el único momento en que alguien la va a dar.

create table if not exists public.inquiry_answer_drafts (
  id            uuid primary key default gen_random_uuid(),
  inquiry_id    uuid not null references public.employee_inquiries(id) on delete cascade,

  borrador      text,
  -- Slugs de manual_sections. Es la trazabilidad: sin esto no se puede
  -- reconstruir de dónde salió una respuesta.
  secciones_citadas text[] not null default '{}',
  -- El agente dice que el manual NO cubre la consulta. Es una respuesta válida
  -- y preferible a inventar.
  hay_respuesta boolean not null default true,
  -- La consulta pide un dato de la persona, que el manual no puede tener.
  necesita_datos_personales boolean not null default false,

  modelo        text not null,
  prompt_version smallint not null default 1,
  secciones_ofrecidas integer not null default 0,
  tokens_entrada integer,
  tokens_salida  integer,
  -- Si la generación falló, queda escrito. Un agente que falla en silencio es
  -- peor que no tenerlo.
  error         text,

  generado_por  uuid references auth.users(id) on delete set null,
  creado_at     timestamptz not null default now(),

  -- USADA = se mandó tal cual. EDITADA = se mandó cambiada, y la respuesta real
  -- queda guardada: el diff contra el borrador es la corrección, que es el dato
  -- que más enseña. DESCARTADA = no se usó.
  resultado     text check (resultado in ('USADA', 'EDITADA', 'DESCARTADA')),
  respuesta_enviada text,
  calificado_at timestamptz,
  calificado_por uuid references auth.users(id) on delete set null
);

comment on table public.inquiry_answer_drafts is
  'Propuestas de respuesta generadas desde el Manual RRHH, y qué hizo HR con cada una.';

create index if not exists idx_inquiry_drafts_consulta
  on public.inquiry_answer_drafts(inquiry_id, creado_at desc);
-- Para medir si el agente sirve: qué proporción se usa tal cual.
create index if not exists idx_inquiry_drafts_resultado
  on public.inquiry_answer_drafts(resultado) where resultado is not null;

alter table public.inquiry_answer_drafts enable row level security;

-- Sin policies de lectura para clientes: las propuestas se sirven desde rutas
-- de servidor con requireAdmin. Pueden citar secciones del manual y no tienen
-- por qué ser legibles desde el browser de un colaborador.
