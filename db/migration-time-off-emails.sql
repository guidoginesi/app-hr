-- Migration: Time-Off Email Notifications
-- Adds email templates and logging for leave request notifications

-- =============================================
-- 1. CREATE EMAIL LOGS TABLE FOR TIME-OFF
-- =============================================
CREATE TABLE IF NOT EXISTS public.time_off_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id UUID REFERENCES public.leave_requests(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_off_email_logs_request ON public.time_off_email_logs(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_time_off_email_logs_template ON public.time_off_email_logs(template_key);
CREATE INDEX IF NOT EXISTS idx_time_off_email_logs_sent_at ON public.time_off_email_logs(sent_at);

-- RLS
ALTER TABLE public.time_off_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage time_off_email_logs" ON public.time_off_email_logs
  FOR ALL
  TO authenticated
  USING (true);

-- =============================================
-- 2. INSERT TIME-OFF EMAIL TEMPLATES
-- =============================================

-- Confirmación de solicitud enviada
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_request_submitted',
  '📌 Tu solicitud de licencia fue recibida',
  E'Hola {{nombre}},

Recibimos tu solicitud de licencia por el período {{fecha_inicio}} a {{fecha_fin}} ({{cantidad_dias}} días).

La misma será revisada por tu líder y por el equipo de People.

Te vamos a avisar por este medio una vez que esté aprobada o si necesitamos algo adicional.

Gracias 😊
Equipo de People',
  'Email enviado cuando un empleado crea una nueva solicitud de licencia',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Solicitud aprobada por Líder
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_approved_leader',
  '✅ Tu solicitud de licencia fue aprobada por tu líder',
  E'Hola {{nombre}},

¡Tu solicitud de licencia fue aprobada! ✅

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}

Tu solicitud ahora será revisada por el equipo de People para la aprobación final.

Equipo de People',
  'Email enviado cuando el líder aprueba una solicitud de licencia',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Solicitud aprobada por HR (aprobación final)
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_approved_hr',
  '✅ Tu solicitud de licencia fue aprobada',
  E'Hola {{nombre}},

¡Tu solicitud de licencia fue aprobada! ✅

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}

Más cerca de la fecha de inicio te vamos a enviar un recordatorio con algunos pasos a tener en cuenta.

Equipo de People',
  'Email enviado cuando HR aprueba una solicitud de licencia (aprobación final)',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Solicitud rechazada
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_rejected',
  '❌ Tu solicitud de licencia no fue aprobada',
  E'Hola {{nombre}},

Tu solicitud de licencia para el período {{fecha_inicio}} a {{fecha_fin}} no pudo ser aprobada en esta oportunidad.

💬 Comentario:
{{comentario}}

Si querés, podés revisar fechas alternativas y volver a cargar la solicitud, o hablarlo con tu líder / RRHH.

Equipo de People',
  'Email enviado cuando una solicitud de licencia es rechazada',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia", "comentario", "rechazado_por"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Modificación/cancelación de vacaciones
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_modified',
  '🔄 Tu licencia fue {{tipo_cambio}}',
  E'Hola {{nombre}},

Te confirmamos que tu licencia fue {{tipo_cambio}} correctamente.

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}

Ante cualquier otra modificación, recordá realizarla con al menos 15 días de anticipación.

Equipo de People',
  'Email enviado cuando una solicitud de licencia es modificada o cancelada',
  '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia", "tipo_cambio"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Notificación al líder (nueva solicitud pendiente)
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_leader_notification',
  '📩 Nueva solicitud de licencia para aprobar',
  E'Hola {{nombre_lider}},

{{nombre_colaborador}} cargó una solicitud de licencia con el siguiente detalle:

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}
📋 Tipo: {{tipo_licencia}}

Te pedimos que la revises y la apruebes o rechaces desde la plataforma.

Gracias,
Equipo de People',
  'Email enviado al líder cuando un colaborador carga una solicitud de licencia',
  '["nombre_lider", "nombre_colaborador", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Notificación a HR (solicitud pendiente de aprobación final)
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_hr_notification',
  '📩 Solicitud de licencia pendiente de aprobación HR',
  E'Hola,

{{nombre_colaborador}} tiene una solicitud de licencia aprobada por su líder que requiere aprobación final de HR:

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}
📋 Tipo: {{tipo_licencia}}
👤 Líder: {{nombre_lider}}

Por favor revisá y aprobá o rechazá la solicitud desde la plataforma.

Gracias,
Sistema de People',
  'Email enviado a HR cuando una solicitud requiere aprobación final',
  '["nombre_colaborador", "fecha_inicio", "fecha_fin", "cantidad_dias", "tipo_licencia", "nombre_lider"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- =============================================
-- VERIFY
-- =============================================
-- SELECT template_key, subject, is_active FROM email_templates WHERE template_key LIKE 'time_off%';
