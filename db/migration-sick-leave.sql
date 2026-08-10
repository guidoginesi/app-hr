-- Licencia por enfermedad — Fase 1 (registro)
--
-- Agrega el tipo de licencia "enfermedad" y el soporte de certificado médico
-- atado a la solicitud. Decisiones de negocio (cerradas con Guido):
--  · Sin aprobación del líder ni de HR: el colaborador la reporta y queda
--    vigente. Al líder se le notifica (sin motivo ni certificado).
--  · Sin cupo (ilimitada): no consume balance.
--  · Certificado OBLIGATORIO, presentado dentro de los 3 días hábiles desde el
--    inicio. Se sube después del registro. Es dato de salud: sólo HR y la propia
--    persona lo ven, nunca el líder.
--  · Sólo enfermedad propia. ART y familiar a cargo quedan fuera de alcance.

-- 1. Tipo de licencia. requires_attachment queda en FALSE a propósito: el
--    certificado no se exige al crear (llega después), la obligación se controla
--    con el plazo, no bloqueando el alta.
INSERT INTO public.leave_types (code, name, description, requires_attachment, advance_notice_days, count_type, is_accumulative) VALUES
  ('sick', 'Licencia por enfermedad', 'Ausencia por enfermedad con certificado médico. No requiere aprobación; se notifica al líder.', false, 0, 'business_days', false)
ON CONFLICT (code) DO NOTHING;

-- 2. Certificado médico asociado a la solicitud. Ruta en el bucket privado
--    'certificates' (el mismo de los certificados del legajo), con prefijo
--    propio 'sick-leave/<leave_id>/...'. El acceso lo decide el endpoint (URL
--    firmada + rol), no la URL.
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS certificate_path        text,
  ADD COLUMN IF NOT EXISTS certificate_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificate_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leave_requests.certificate_path IS
  'Ruta del certificado médico en el bucket privado certificates. Sólo para licencias de enfermedad.';

-- La view leave_requests_with_details hace SELECT lr.*, así que las columnas
-- nuevas se exponen solas. No hay que redefinirla.

-- 3. Plantilla de mail al líder: es NOTIFICACIÓN de cobertura, no un pedido de
--    aprobación. No incluye motivo ni certificado (dato de salud).
INSERT INTO public.email_templates (template_key, subject, body, description, variables, is_active)
VALUES (
  'time_off_sick_leader_notification',
  'Tu equipo: licencia por enfermedad de {{nombre_colaborador}}',
  E'Hola {{nombre_lider}},

Te avisamos para que puedas organizar la cobertura: {{nombre_colaborador}} está de licencia por enfermedad.

📆 Período: {{fecha_inicio}} a {{fecha_fin}}
🗓️ Cantidad de días: {{cantidad_dias}}

No hace falta que apruebes nada. El certificado y el detalle los gestiona People.

Gracias,
Equipo de People',
  'Aviso al líder cuando un colaborador registra una licencia por enfermedad (no requiere aprobación)',
  '["nombre_lider", "nombre_colaborador", "fecha_inicio", "fecha_fin", "cantidad_dias"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables;

-- Nota: leave_requests ya tiene RLS y la app escribe con service_role; las
-- columnas nuevas heredan los grants de la tabla, no requieren revoke aparte.
