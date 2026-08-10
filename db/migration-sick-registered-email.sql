-- Mail de confirmación propio para la licencia por enfermedad.
--
-- Hasta ahora usaba la plantilla genérica time_off_request_submitted, que dice
-- cosas que en enfermedad NO pasan: la llama "solicitud", avisa que "será
-- revisada por tu líder y por el equipo de People" y promete avisar "una vez que
-- esté aprobada". La licencia por enfermedad no se aprueba: queda vigente al
-- registrarse.
--
-- El mail nuevo dice lo que sí pasa —quedó registrada, al líder se le avisó sin
-- el motivo, y falta el certificado con su fecha límite— que además es la única
-- acción pendiente del colaborador.

INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_sick_registered',
  'Registramos tu licencia por enfermedad',
  E'Hola {{nombre}},

Registramos tu licencia por enfermedad del {{fecha_inicio}} al {{fecha_fin}} ({{cantidad_dias}} día(s)). Ya está vigente: no necesita la aprobación de nadie.

Le avisamos a tu líder que vas a estar ausente y por cuántos días. No ve el motivo ni el certificado.

Te queda un paso: subí el certificado médico antes del {{fecha_vencimiento}} — son {{plazo_certificado}} días hábiles desde el inicio de la licencia. Si se pasa el plazo la licencia no se anula, pero te lo vamos a recordar.

Que te mejores.
Equipo de People',
  'Confirmación al colaborador cuando registra una licencia por enfermedad (no requiere aprobación)',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "fecha_vencimiento", "plazo_certificado"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;
