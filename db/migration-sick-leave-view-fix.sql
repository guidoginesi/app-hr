-- Fix: exponer las columnas del certificado médico en leave_requests_with_details.
--
-- migration-sick-leave.sql agregó certificate_path / certificate_uploaded_at /
-- certificate_uploaded_by a leave_requests dando por sentado que la vista, al
-- estar definida con `SELECT lr.*`, las tomaría sola. NO es así: Postgres
-- expande el `*` al CREAR la vista y congela la lista de columnas. Agregar
-- columnas a la tabla después no las suma a la vista.
--
-- Consecuencias mientras estuvo roto: el chip del certificado se quedaba en
-- "pendiente" aunque el archivo estuviera cargado, el botón "Ver" nunca
-- aparecía, y el recordatorio del cron fallaba al filtrar por una columna que
-- la vista no tenía.
--
-- Se recrea con las columnas explícitas (mismo criterio que usó
-- migration-leave-plus-paid.sql al agregar plus_paid) y conservando
-- security_invoker.
--
-- De paso, los nombres derivados pasan de concat() a trim(concat_ws(...)):
-- concat() IGNORA los NULL y devuelve ' ' (un espacio) cuando el LEFT JOIN no
-- trajo fila. Ese espacio es truthy en JS, asi que el admin mostraba 'HR:' y
-- 'Lider:' con el valor en blanco en toda licencia sin aprobador. Con
-- trim(concat_ws(...)) devuelve '' y las guardas del front funcionan.

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
  -- Nuevas: certificado médico de la licencia por enfermedad.
  lr.certificate_path,
  lr.certificate_uploaded_at,
  lr.certificate_uploaded_by
FROM public.leave_requests lr
  JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  JOIN public.employees e ON lr.employee_id = e.id
  LEFT JOIN public.employees m ON e.manager_id = m.id
  LEFT JOIN public.employees a ON lr.approved_by = a.id
  LEFT JOIN public.employees l ON lr.leader_id = l.id
  LEFT JOIN public.employees hr ON lr.hr_approved_by = hr.id;
