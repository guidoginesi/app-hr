-- Contenidos de People en la Ayuda del portal, editables desde el admin.
--
-- Reemplazan la página de Recursos Humanos del Pow Site, que quedó
-- desactualizada: buena parte de lo que explicaba (pedir días, cargar una
-- capacitación) ahora se hace desde la app, y el sitio no se enteró.
--
-- Cada fila es un contenido del índice de Ayuda, agrupado por `seccion`, que
-- es un tema. Si tiene `cuerpo_html` se lee en el portal; si sólo tiene
-- `link_url`, abre ese link (un formulario, un doc).
--
-- Se lee y se escribe sólo desde el server, con la service role: sin políticas.

CREATE TABLE IF NOT EXISTS public.ayuda_contenidos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  seccion     text NOT NULL DEFAULT 'General',
  titulo      text NOT NULL,
  resumen     text,
  cuerpo_html text NOT NULL DEFAULT '',
  link_url    text,
  -- A quién se le muestra: hay temas que sólo aplican a una forma de contratación.
  audiencia   text NOT NULL DEFAULT 'todos'
              CHECK (audiencia IN ('todos', 'dependency', 'monotributista')),
  -- Uno del catálogo del portal (ver ayudaContenidos.ts). NULL = lo elige solo, por el título.
  icono       text,
  orden       integer NOT NULL DEFAULT 100,
  publicado   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);

-- Por si la tabla ya estaba creada sin el ícono.
ALTER TABLE public.ayuda_contenidos ADD COLUMN IF NOT EXISTS icono text;

CREATE INDEX IF NOT EXISTS idx_ayuda_contenidos_publicado ON public.ayuda_contenidos (publicado, orden);

ALTER TABLE public.ayuda_contenidos ENABLE ROW LEVEL SECURITY;
