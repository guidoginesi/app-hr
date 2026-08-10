-- Día de cumpleaños: tipo de licencia propio + textos del automatismo.
--
-- Hasta ahora el beneficio se otorgaba a mano: un ajuste de +1 día sobre el
-- saldo de Días Pow, con el motivo escrito libre ("Dia de Cumpleaños",
-- "Día de cumpleaños 14/2", …). Eso lo dejaba indistinguible de los 5 Días Pow
-- y obligaba a que la persona aclarara en Observaciones qué estaba tomando.
--
-- Con tipo propio: saldo separado, visible como lo que es, y reportable sin
-- depender de un texto libre.
--
-- El saldo lo administra el CRON, no calculateEntitledDays: lo acredita cuando
-- llega el mes del cumpleaños y lo vence al cerrarse la ventana. Si el derecho
-- fuera anual fijo, alguien fuera de su ventana vería "1 día disponible" que no
-- puede usar.

INSERT INTO public.leave_types
  (code, name, description, requires_attachment, advance_notice_days, count_type, is_accumulative, sort_order)
VALUES (
  'birthday',
  'Día de cumpleaños',
  'Un día por tu cumpleaños. Se puede tomar desde el día del cumple y hasta 7 días corridos después.',
  false, 0, 'business_days', false, 25
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  count_type = EXCLUDED.count_type,
  sort_order = EXCLUDED.sort_order;

-- Aviso de que el día quedó disponible. Reemplaza el mensaje que People venía
-- mandando a mano. No repite el "cargalo desde Días Pow y aclará en
-- Observaciones" del texto anterior: con el tipo propio eso ya no aplica.
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'birthday_leave_available',
  '🎂 ¡Ya tenés habilitado tu Día de Cumpleaños!',
  E'¡Hola {{firstName}}!

Ya tenés habilitado tu Día de Cumpleaños en la plataforma 🎉

Lo cargás desde el Portal, en Time Off → Nueva solicitud, eligiendo el tipo "Día de cumpleaños". No hace falta que aclares nada: ya viene identificado.

Podés tomarlo entre el {{ventanaDesde}} y el {{ventanaHasta}}. Si no lo usás en esa ventana, se pierde.

¡Cualquier consulta estoy a disposición!
Un abrazo,
Equipo de People',
  'Aviso automático al colaborador cuando se le acredita el día de cumpleaños',
  '["firstName", "ventanaDesde", "ventanaHasta"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Saludo: se adopta el texto de Tini. El anterior era más corto y genérico.
UPDATE public.email_templates
SET subject = '🎉 ¡Feliz en tu día, {{firstName}}!',
    body = E'¡Feliz cumple, {{firstName}}! 🥳

De parte de todo el equipo de Pow, te deseamos un super día de cumple, esperamos que la pases hermoso y disfrutes con la gente que querés.

Que este nuevo año te traiga salud, cosas lindas y un montón de motivos para festejar. ¡Te lo merecés!

Un abrazo enorme,
Equipo de People'
WHERE template_key = 'birthday_greeting';
