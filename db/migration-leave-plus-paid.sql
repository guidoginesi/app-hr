-- Migration: Vacaciones ya liquidadas (plus vacacional ya pagado)
-- ---------------------------------------------------------------
-- Caso de uso: a veces el plus vacacional se paga en un período (ej. marzo)
-- pero las vacaciones se toman en otro (ej. octubre). Esas vacaciones NO deben
-- informarse para el pago de plus porque ya fueron liquidadas.
--
-- Se agrega un flag por solicitud. Aplica a nivel producto sólo a Vacaciones.

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS plus_paid boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leave_requests.plus_paid IS
  'Vacaciones ya liquidadas: el plus vacacional ya fue pagado en otro período; se excluye del reporte de plus.';

-- Recrear la vista para exponer la nueva columna.
-- La columna se agrega AL FINAL (requisito de CREATE OR REPLACE VIEW) y se
-- preserva security_invoker=true.
CREATE OR REPLACE VIEW public.leave_requests_with_details
WITH (security_invoker = true) AS
 SELECT lr.id,
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
    concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.photo_url AS employee_photo_url,
    e.manager_id AS employee_manager_id,
    concat(m.first_name, ' ', m.last_name) AS manager_name,
    concat(a.first_name, ' ', a.last_name) AS approver_name,
    concat(l.first_name, ' ', l.last_name) AS leader_name,
    concat(hr.first_name, ' ', hr.last_name) AS hr_approver_name,
    lr.plus_paid
   FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     JOIN employees e ON lr.employee_id = e.id
     LEFT JOIN employees m ON e.manager_id = m.id
     LEFT JOIN employees a ON lr.approved_by = a.id
     LEFT JOIN employees l ON lr.leader_id = l.id
     LEFT JOIN employees hr ON lr.hr_approved_by = hr.id;
