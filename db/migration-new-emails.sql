-- Agregar campo is_active a email_templates si no existe
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Agregar comentario
COMMENT ON COLUMN public.email_templates.is_active IS 'Indica si el email está activo (on/off)';

-- Agregar campo max_salary a jobs para el trigger de rechazo por sueldo
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS max_salary numeric;

COMMENT ON COLUMN public.jobs.max_salary IS 'Salario máximo para la posición. Si el candidato excede este monto, será descartado automáticamente';

-- Insertar nuevas plantillas de email
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active) VALUES
(
  'application_confirmation',
  '¡Recibimos tu postulación en POW!',
  E'<p>Hola {{candidateName}},</p>\n\n<p>¡Gracias por postularte a la posición de <strong>{{jobTitle}}</strong> en POW!</p>\n\n<p>Hemos recibido tu CV y estamos revisando tu perfil. Nuestro equipo de Recursos Humanos evaluará tu postulación y nos pondremos en contacto contigo en caso de que tu perfil avance en el proceso de selección.</p>\n\n<p>Te mantendremos informado sobre el estado de tu aplicación.</p>\n\n<p>Apreciamos tu interés en formar parte de nuestro equipo.</p>\n\n<p>Saludos cordiales,<br>Equipo de Recursos Humanos<br>POW</p>',
  'Email de confirmación enviado automáticamente cuando un candidato aplica a una posición',
  '["candidateName", "jobTitle"]'::jsonb,
  true
),
(
  'candidate_rejected_salary',
  'Actualización sobre tu postulación en POW',
  E'Hola {{candidateName}},\n\nGracias por tu interés en la posición de {{jobTitle}} en POW.\n\nDespués de revisar tu perfil y tu expectativa salarial ({{salaryExpectation}}), lamentamos informarte que en este momento el rango salarial de la posición no se ajusta a tus expectativas.\n\nApreciamos mucho el tiempo que dedicaste a postularte y te animamos a seguir atento a futuras oportunidades que puedan alinearse mejor con tus expectativas.\n\nTe deseamos mucho éxito en tu búsqueda laboral.\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado cuando un candidato es descartado automáticamente por exceder el salario máximo de la posición',
  '["candidateName", "jobTitle", "salaryExpectation"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;


