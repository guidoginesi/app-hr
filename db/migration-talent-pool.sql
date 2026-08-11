-- Banco de Talentos: postulaciones espontáneas.
--
-- El modelo de reclutamiento actual no las admite: una postulación exige
-- búsqueda (`applications.job_id`) y CV (`resume_url`), y quien deja sus datos
-- "por si aparece algo" no tiene búsqueda a la que apuntar. Por eso una tabla
-- propia.
--
-- Lo que NO es una tabla propia es la persona: el banco cuelga de `candidates`,
-- que ya es única por mail. Así quien deja sus datos y además se postula a una
-- búsqueda es UNA persona con dos entradas, y no dos fichas que nadie cruza.

-- ── Áreas de interés ──────────────────────────────────────────────────
-- Configurable y no fija en el código: son las áreas como las entiende alguien
-- de afuera, que no son las de la app (acá "IT" son tres áreas distintas).
-- Un área nunca se borra, se desactiva: borrarla dejaría sin área a los
-- registros viejos. Mismo criterio que expense_reasons.
CREATE TABLE IF NOT EXISTS public.talent_pool_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS talent_pool_areas_name_unique
  ON public.talent_pool_areas (lower(name));

INSERT INTO public.talent_pool_areas (name, sort_order) VALUES
  ('Comercial', 10),
  ('CX', 20),
  ('Growth', 30),
  ('IT', 40),
  ('Producto', 50),
  ('Marketing', 60),
  ('RRHH', 70),
  ('Diseño', 80),
  -- "Otro" queda siempre al final aunque después se agreguen áreas nuevas.
  ('Otro', 900)
ON CONFLICT DO NOTHING;

-- ── Estados ───────────────────────────────────────────────────────────
-- NEW        entra así todo el que deja sus datos
-- ON_HOLD    buen perfil sin búsqueda que le aplique hoy
-- DISCARDED  no encaja
-- ASSIGNED   ya lo mandaste a una búsqueda; el registro NO sale del banco
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'talent_pool_status') THEN
    CREATE TYPE talent_pool_status AS ENUM ('NEW', 'ON_HOLD', 'DISCARDED', 'ASSIGNED');
  END IF;
END $$;

-- ── Entradas del banco ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.talent_pool_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,

  areas text[] NOT NULL DEFAULT '{}',
  seniority text,
  message text,

  -- El PATH dentro del bucket, no la URL. El bucket de CVs hoy es público y va
  -- a dejar de serlo; guardando el path, cerrarlo no invalida estos registros.
  resume_path text NOT NULL,

  status talent_pool_status NOT NULL DEFAULT 'NEW',
  status_changed_at timestamptz,
  status_changed_by uuid,

  -- Asignación a una búsqueda. La postulación creada vive en `applications`;
  -- acá queda el rastro para que el banco muestre qué se hizo con la persona.
  assigned_application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  assigned_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by uuid,

  submissions_count integer NOT NULL DEFAULT 1,
  last_submitted_at timestamptz NOT NULL DEFAULT now(),
  -- Se marca cuando alguien vuelve a dejar sus datos después de que HR ya
  -- decidió (descartado o asignado). En ese caso el estado NO se resetea:
  -- devolver un descartado a la bandeja lo trae de vuelta cada vez.
  resubmitted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Una entrada por persona: si vuelve a mandar sus datos, se actualiza la que ya
-- tiene. Sin esto el banco se llena de la misma persona repetida.
CREATE UNIQUE INDEX IF NOT EXISTS talent_pool_entries_candidate_unique
  ON public.talent_pool_entries (candidate_id);

CREATE INDEX IF NOT EXISTS talent_pool_entries_status_idx
  ON public.talent_pool_entries (status, created_at DESC);

-- ── Anti-spam ─────────────────────────────────────────────────────────
-- Formulario público con subida de archivo: sin un tope, un script llena el
-- banco y el bucket. Se guarda el hash de la IP, no la IP: alcanza para contar
-- envíos y no es un dato personal más para cuidar.
CREATE TABLE IF NOT EXISTS public.talent_pool_submission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_pool_submission_log_ip_idx
  ON public.talent_pool_submission_log (ip_hash, created_at DESC);

-- ── Origen de la postulación ──────────────────────────────────────────
-- Para que dentro de la búsqueda se vea de dónde salió el perfil.
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS source text;

-- ── Mail de confirmación al candidato ─────────────────────────────────
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'talent_pool_confirmation',
  '¡Gracias por sumarte a nuestro Banco de Talentos!',
  E'¡Hola {{candidateName}}!

Recibimos tus datos y ya sos parte de nuestro Banco de Talentos.

Esto quiere decir que tu perfil queda en nuestro radar: cuando abramos una búsqueda que tenga que ver con lo tuyo, vamos a tenerte en cuenta.

No hace falta que hagas nada más. Si aparece algo que encaje, te escribimos nosotros.

Mientras tanto, podés seguir mirando nuestras búsquedas abiertas por si se publica alguna que te interese.

¡Gracias por el interés en Pow!
Equipo de People',
  'Confirmación automática a quien deja sus datos en el Banco de Talentos',
  '["candidateName"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;
