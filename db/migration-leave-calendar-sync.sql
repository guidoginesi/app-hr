-- Sincronización de licencias con el Google Calendar del equipo.
--
-- Hasta ahora el botón "Google Calendar" era un link `action=TEMPLATE`: abría
-- Google con los campos precargados y alguien todavía tenía que apretar Guardar.
-- Nadie sabía si el evento existía, y cancelar una licencia no lo borraba: el
-- calendario seguía mostrando una ausencia que ya no era.
--
-- `google_event_id` es lo que convierte eso en una integración: con el id
-- podemos actualizar el evento si cambian las fechas y borrarlo si se cancela.
-- Sin id sólo se puede crear, que es otra forma de decir duplicar.

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leave_requests.google_event_id IS
  'Id del evento en el calendario compartido. NULL = no está en el calendario.';
COMMENT ON COLUMN public.leave_requests.calendar_synced_at IS
  'Última vez que el evento se creó o actualizó. Sirve para encontrar las que quedaron atrás si el calendario estuvo caído.';

-- Las que no están sincronizadas y deberían: el trabajo pendiente del backfill
-- y de cualquier reintento.
CREATE INDEX IF NOT EXISTS idx_leave_requests_sin_calendario
  ON public.leave_requests (status)
  WHERE google_event_id IS NULL;

-- La vista enumera columnas, así que hay que agregarlas a mano.
CREATE OR REPLACE VIEW public.leave_requests_with_details
WITH (security_invoker = true)
AS
SELECT
  lr.id,
  lr.employee_id,
  lr.leave_type_id,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.status,
  lr.notes,
  lr.attachment_url,
  lr.approved_by,
  lr.approved_at,
  lr.rejection_reason,
  lr.created_at,
  lr.updated_at,
  lr.leader_id,
  lr.leader_approved_at,
  lr.leader_rejection_reason,
  lr.hr_approved_by,
  lr.hr_approved_at,
  lr.hr_rejection_reason,
  lt.code AS leave_type_code,
  lt.name AS leave_type_name,
  lt.count_type,
  lt.requires_attachment,
  lt.advance_notice_days,
  trim(concat_ws(' ', e.first_name, e.last_name)) AS employee_name,
  e.photo_url AS employee_photo_url,
  e.manager_id AS employee_manager_id,
  trim(concat_ws(' ', m.first_name, m.last_name)) AS manager_name,
  trim(concat_ws(' ', a.first_name, a.last_name)) AS approver_name,
  trim(concat_ws(' ', l.first_name, l.last_name)) AS leader_name,
  trim(concat_ws(' ', hr.first_name, hr.last_name)) AS hr_approver_name,
  lr.plus_paid,
  lr.certificate_path,
  lr.certificate_uploaded_at,
  lr.certificate_uploaded_by,
  -- Nuevas: sincronización con el calendario del equipo.
  lr.google_event_id,
  lr.calendar_synced_at
FROM public.leave_requests lr
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  JOIN public.employees e ON lr.employee_id = e.id
  LEFT JOIN public.employees m ON e.manager_id = m.id
  LEFT JOIN public.employees a ON lr.approved_by = a.id
  LEFT JOIN public.employees l ON lr.leader_id = l.id
  LEFT JOIN public.employees hr ON lr.hr_approved_by = hr.id;
