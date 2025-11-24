-- Agregar 2 nuevas plantillas de email

-- 1. Email de confirmación de aplicación
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active) VALUES
(
  'application_confirmation',
  '¡Recibimos tu postulación en POW!',
  E'Hola {{candidateName}},\n\n¡Gracias por postularte a la posición de {{jobTitle}} en POW!\n\nHemos recibido tu CV y nuestro equipo de Recursos Humanos lo revisará cuidadosamente.\n\nSi tu perfil se ajusta a lo que estamos buscando, nos pondremos en contacto contigo para los siguientes pasos del proceso de selección.\n\nEste proceso puede tomar algunos días, así que te pedimos un poco de paciencia.\n\nGracias por tu interés en formar parte de nuestro equipo.\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado automáticamente cuando un candidato completa su postulación',
  '["candidateName", "jobTitle"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;

-- 2. Email de rechazo por sueldo pretendido
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active) VALUES
(
  'candidate_rejected_salary',
  'Actualización sobre tu postulación en POW',
  E'Hola {{candidateName}},\n\nGracias por tu interés en la posición de {{jobTitle}} en POW y por compartir tu expectativa salarial con nosotros.\n\nDespués de revisar tu perfil, lamentablemente la expectativa salarial que mencionaste ({{salaryExpectation}}) se encuentra fuera del rango presupuestado para esta posición.\n\nApreciamos mucho tu interés y el tiempo que dedicaste a postularte. Te invitamos a seguir atento a futuras oportunidades que puedan ajustarse mejor a tus expectativas.\n\nTe deseamos mucho éxito en tu búsqueda laboral.\n\nSaludos cordiales,\nEquipo de Recursos Humanos\nPOW',
  'Email enviado automáticamente cuando el sueldo pretendido excede el máximo de la posición',
  '["candidateName", "jobTitle", "salaryExpectation"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;

