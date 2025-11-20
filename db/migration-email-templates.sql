-- Crear tabla para plantillas de email editables
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  description text,
  variables jsonb DEFAULT '[]'::jsonb, -- Lista de variables disponibles para usar
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Crear tabla para logs de emails enviados
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  candidate_email text NOT NULL,
  template_key text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  error text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Índices para email_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_application ON public.email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_key ON public.email_logs(template_key);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);

-- Trigger para actualizar updated_at en email_templates
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insertar plantillas por defecto
INSERT INTO public.email_templates (template_key, subject, body, description, variables) VALUES
(
  'candidate_rejected',
  'Actualización sobre tu postulación en POW',
  E'Hola {{candidateName}},\n\nGracias por tu interés en la posición de {{jobTitle}} en POW.\n\nDespués de una cuidadosa revisión, hemos decidido continuar con otros candidatos cuyo perfil se ajusta más a nuestras necesidades actuales.\n\nApreciamos el tiempo que dedicaste a postularte y te animamos a seguir atento a futuras oportunidades en nuestra empresa.\n\nTe deseamos mucho éxito en tu búsqueda laboral.\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado cuando un candidato es descartado en cualquier etapa del proceso',
  '["candidateName", "jobTitle", "stage"]'::jsonb
),
(
  'interview_coordination',
  '¡Buenas noticias sobre tu postulación en POW!',
  E'Hola {{candidateName}},\n\n¡Tenemos buenas noticias! Tu perfil ha sido seleccionado para continuar en el proceso de selección para la posición de {{jobTitle}}.\n\nNos gustaría coordinar una entrevista contigo. En breve, un miembro de nuestro equipo de Recursos Humanos se pondrá en contacto para agendar un horario que te resulte conveniente.\n\nSi tienes alguna pregunta, no dudes en responder este correo.\n\n¡Esperamos conocerte pronto!\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado cuando se completa la revisión de HR y se avanza a entrevista',
  '["candidateName", "jobTitle"]'::jsonb
),
(
  'candidate_rejected_location',
  'Información sobre tu postulación en POW',
  E'Hola {{candidateName}},\n\nGracias por tu interés en la posición de {{jobTitle}} en POW.\n\nActualmente, esta posición requiere que el candidato resida en CABA o GBA. Lamentablemente, no podemos continuar con tu postulación en este momento debido a la ubicación geográfica.\n\nTe invitamos a seguir atento a futuras oportunidades que puedan ajustarse mejor a tu ubicación.\n\nApreciamos mucho tu interés en formar parte de nuestro equipo.\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado cuando un candidato es descartado automáticamente por provincia OTRA',
  '["candidateName", "jobTitle", "provincia"]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;

