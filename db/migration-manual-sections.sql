-- Manual de RRHH importado desde el Google Doc
--
-- El Doc sigue siendo la fuente: la gente lo edita ahí y un Apps Script pegado
-- al documento empuja las secciones a la app. Esto es la copia consultable, no
-- el original.
--
-- Lo que tiene que sobrevivir a cada reimportación es la marca de audiencia:
-- decidir 165 veces qué se le puede citar a un colaborador es trabajo humano y
-- no se puede perder porque alguien corrigió una coma en el Doc.

create table if not exists public.manual_sections (
  id            uuid primary key default gen_random_uuid(),

  -- Identidad estable entre importaciones. Sale de la jerarquía de títulos, así
  -- que renombrar un encabezado crea una sección nueva y jubila la vieja: es
  -- correcto, porque un título distinto puede ser contenido distinto.
  slug          text not null unique,
  ruta          text[] not null,
  titulo        text not null,
  nivel         smallint not null,
  orden         integer not null,

  texto         text not null default '',
  -- Hash del texto: es lo que distingue "cambió" de "vino igual".
  hash          text not null,
  anchor        text,

  -- EMPLEADO   se le puede citar a un colaborador
  -- SOLO_HR    no sale del panel de HR
  -- SIN_DEFINIR nadie la revisó todavía
  --
  -- Falla cerrado a propósito: una sección nueva NUNCA nace en EMPLEADO. Si el
  -- Doc suma mañana "Plan de desvinculaciones", no se cita hasta que alguien lo
  -- habilite a mano.
  audiencia            text not null default 'SIN_DEFINIR'
    check (audiencia in ('EMPLEADO', 'SOLO_HR', 'SIN_DEFINIR')),
  audiencia_sugerida   text
    check (audiencia_sugerida in ('EMPLEADO', 'SOLO_HR')),
  audiencia_definida_por uuid references auth.users(id) on delete set null,
  audiencia_definida_at  timestamptz,

  -- Una sección que desaparece del Doc no se borra: puede haber respuestas que
  -- la citaron y hay que poder explicar de dónde salieron.
  vigente        boolean not null default true,
  desaparecio_at timestamptz,

  creado_at      timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

comment on column public.manual_sections.audiencia is
  'Si se le puede citar a un colaborador. Las secciones nuevas nacen en SIN_DEFINIR: falla cerrado.';
comment on column public.manual_sections.audiencia_definida_at is
  'Cuándo se revisó. Si `actualizado_at` es posterior, el texto cambió después de la revisión y hay que mirarla de nuevo.';

create index if not exists idx_manual_sections_audiencia
  on public.manual_sections(audiencia) where vigente;
create index if not exists idx_manual_sections_orden
  on public.manual_sections(orden) where vigente;

-- Historial de importaciones: sin esto, "el agente respondió distinto que ayer"
-- no se puede explicar.
create table if not exists public.manual_imports (
  id          uuid primary key default gen_random_uuid(),
  origen      text not null,
  recibidas   integer not null default 0,
  nuevas      integer not null default 0,
  modificadas integer not null default 0,
  sin_cambios integer not null default 0,
  jubiladas   integer not null default 0,
  detalle     jsonb,
  creado_at   timestamptz not null default now()
);

create index if not exists idx_manual_imports_fecha on public.manual_imports(creado_at desc);

alter table public.manual_sections enable row level security;
alter table public.manual_imports  enable row level security;

-- Sin policies de lectura para clientes: el manual se sirve desde rutas de
-- servidor, que son las que saben si quien pregunta puede ver una sección
-- SOLO_HR. Dejarlo legible desde el browser sería publicar el procedimiento de
-- despido.
