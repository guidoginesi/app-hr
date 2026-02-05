-- Migration: Add unit label variable to time-off email templates
-- Changes "días" to use a dynamic variable {{unidad_tiempo}} that can be "días" or "semanas"

-- Update: Confirmación de solicitud enviada
UPDATE public.email_templates 
SET 
  body = E'Hola {{nombre}},

Recibimos tu solicitud de licencia por el período {{fecha_inicio}} a {{fecha_fin}} ({{cantidad_dias}} {{unidad_tiempo}}).

La misma será revisada por tu líder y por el equipo de People.

Te vamos a avisar por este medio una vez que esté aprobada o si necesitamos algo adicional.

Gracias 😊
Equipo de People',
  variables = '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia"]'::jsonb
WHERE template_key = 'time_off_request_submitted';

-- Update: Solicitud aprobada por Líder
UPDATE public.email_templates 
SET 
  body = E'Hola {{nombre}},

¡Tu solicitud de licencia fue aprobada! ✅

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad: {{cantidad_dias}} {{unidad_tiempo}}

Tu solicitud ahora será revisada por el equipo de People para la aprobación final.

Equipo de People',
  variables = '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia"]'::jsonb
WHERE template_key = 'time_off_approved_leader';

-- Update: Solicitud aprobada por HR (aprobación final)
UPDATE public.email_templates 
SET 
  body = E'Hola {{nombre}},

¡Tu solicitud de licencia fue aprobada! ✅

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad: {{cantidad_dias}} {{unidad_tiempo}}

Más cerca de la fecha de inicio te vamos a enviar un recordatorio con algunos pasos a tener en cuenta.

Equipo de People',
  variables = '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia"]'::jsonb
WHERE template_key = 'time_off_approved_hr';

-- Update: Modificación/cancelación de vacaciones
UPDATE public.email_templates 
SET 
  body = E'Hola {{nombre}},

Te confirmamos que tu licencia fue {{tipo_cambio}} correctamente.

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad: {{cantidad_dias}} {{unidad_tiempo}}

Ante cualquier otra modificación, recordá realizarla con al menos 15 días de anticipación.

Equipo de People',
  variables = '["nombre", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia", "tipo_cambio"]'::jsonb
WHERE template_key = 'time_off_modified';

-- Update: Notificación al líder (nueva solicitud pendiente)
UPDATE public.email_templates 
SET 
  body = E'Hola {{nombre_lider}},

{{nombre_colaborador}} cargó una solicitud de licencia con el siguiente detalle:

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad: {{cantidad_dias}} {{unidad_tiempo}}
📋 Tipo: {{tipo_licencia}}

Te pedimos que la revises y la apruebes o rechaces desde la plataforma.

Gracias,
Equipo de People',
  variables = '["nombre_lider", "nombre_colaborador", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia"]'::jsonb
WHERE template_key = 'time_off_leader_notification';

-- Update: Notificación a HR (solicitud pendiente de aprobación final)
UPDATE public.email_templates 
SET 
  body = E'Hola,

{{nombre_colaborador}} tiene una solicitud de licencia aprobada por su líder que requiere aprobación final de HR:

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad: {{cantidad_dias}} {{unidad_tiempo}}
📋 Tipo: {{tipo_licencia}}
👤 Líder: {{nombre_lider}}

Por favor revisá y aprobá o rechazá la solicitud desde la plataforma.

Gracias,
Sistema de People',
  variables = '["nombre_colaborador", "fecha_inicio", "fecha_fin", "cantidad_dias", "unidad_tiempo", "tipo_licencia", "nombre_lider"]'::jsonb
WHERE template_key = 'time_off_hr_notification';

-- Note: time_off_rejected doesn't show "días" in its body, so no change needed
