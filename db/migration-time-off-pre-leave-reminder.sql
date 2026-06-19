-- Migration: Pre-leave reminder email (Gmail, Calendar, Asana OOO setup)
-- Sent automatically 1 day before an approved leave starts.

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'recruiting';

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS send_internal_message boolean NOT NULL DEFAULT false;

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS internal_message_text text;

INSERT INTO public.email_templates (
  template_key,
  subject,
  body,
  description,
  variables,
  is_active,
  category,
  send_internal_message,
  internal_message_text
) VALUES (
  'time_off_pre_leave_reminder',
  '🏖️ Tu licencia empieza mañana — configurá tu fuera de oficina',
  E'Hola {{nombre}},

Tu licencia de **{{tipo_licencia}}** comienza mañana ({{fecha_inicio}}) y termina el {{fecha_fin}}.

Antes de desconectarte, te dejamos una guía rápida para avisar a tu equipo en las herramientas que usamos:

---

**📧 Gmail — Respuesta automática**

1. Abrí Gmail → **⚙️ Configuración** → **Ver toda la configuración**.
2. En **General**, buscá **Respuesta de vacaciones**.
3. Activá **Respuesta de vacaciones activada**.
4. Escribí un mensaje indicando que estás fuera de oficina hasta el {{fecha_fin}}.
5. (Opcional) Configurá las fechas de inicio y fin del mensaje automático.
6. Guardá los cambios al final de la página.

---

**📅 Google Calendar — Fuera de oficina**

1. Abrí Google Calendar → **⚙️ Configuración** → **Configuración**.
2. En el menú izquierdo, seleccioná tu calendario principal.
3. En **Horario laboral y ubicación**, activá **Mostrar fuera de oficina** para las fechas de tu licencia.
4. Alternativa: creá un evento de día completo del {{fecha_inicio}} al {{fecha_fin}} con título "Fuera de oficina" y visibilidad **Ocupado**.

---

**✅ Asana — Estado de ausencia**

1. Abrí Asana y hacé clic en tu foto de perfil (arriba a la derecha).
2. Seleccioná **Establecer estado**.
3. Elegí **De vacaciones** o escribí un mensaje personalizado.
4. Configurá la fecha de fin: {{fecha_fin}}.

---

Si tenés dudas, escribinos a People.

¡Que descanses!
Equipo de People',
  'Email enviado automáticamente 1 día antes del inicio de una licencia aprobada, con instrucciones para configurar fuera de oficina en Gmail, Calendar y Asana',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia"]'::jsonb,
  true,
  'automation',
  true,
  E'Hola {{nombre}}, mañana comienza tu licencia de {{tipo_licencia}} ({{fecha_inicio}} al {{fecha_fin}}). Revisá tu email con los pasos para configurar fuera de oficina en Gmail, Calendar y Asana.'
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  category = EXCLUDED.category,
  send_internal_message = EXCLUDED.send_internal_message,
  internal_message_text = EXCLUDED.internal_message_text;
