-- Agregar template de email para entrevista con líder de área
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active) VALUES
(
  'lead_interview_coordination',
  'Próxima etapa: Entrevista con el líder de área - {{jobTitle}}',
  E'<p>Hola {{candidateName}},</p>\n\n<p>¡Excelentes noticias! Has avanzado a la siguiente etapa del proceso de selección para la posición de <strong>{{jobTitle}}</strong> en POW.</p>\n\n<p>Nos gustaría coordinar una entrevista contigo con el líder del área. En breve, un miembro de nuestro equipo se pondrá en contacto contigo para agendar un horario que se ajuste a tu disponibilidad.</p>\n\n<p>Esta entrevista será una oportunidad para que conozcas más sobre el rol, el equipo y la cultura de POW, y para que nosotros conozcamos mejor tu experiencia y expectativas.</p>\n\n<p>Si tienes alguna pregunta o preferencia de horario, no dudes en responder este correo.</p>\n\n<p>¡Esperamos conocerte mejor!</p>\n\n<p>Saludos cordiales,<br>Equipo de Recursos Humanos<br>POW</p>',
  'Email enviado cuando un candidato avanza a la etapa de entrevista con el líder de área (LEAD_INTERVIEW)',
  '["candidateName", "jobTitle"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active;

