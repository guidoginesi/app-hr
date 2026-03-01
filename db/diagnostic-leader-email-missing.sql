-- ============================================================
-- DIAGNOSTIC: Leaders with missing emails who could not
-- receive time-off notification emails
-- ============================================================

-- 1. Employees that have at least one subordinate (i.e. they ARE a manager)
--    but have no work_email and no personal_email in the employees table.
SELECT
  e.id,
  e.first_name,
  e.last_name,
  e.work_email,
  e.personal_email,
  e.user_id,
  COUNT(reports.id) AS direct_reports_count
FROM public.employees e
JOIN public.employees reports ON reports.manager_id = e.id
WHERE e.work_email IS NULL
  AND e.personal_email IS NULL
GROUP BY e.id, e.first_name, e.last_name, e.work_email, e.personal_email, e.user_id
ORDER BY direct_reports_count DESC;

-- 2. Leave requests where the leader notification email was NOT sent
--    (no entry in time_off_email_logs for that request + template).
SELECT
  lr.id AS leave_request_id,
  lr.created_at,
  lr.status,
  emp.first_name || ' ' || emp.last_name AS employee_name,
  mgr.first_name || ' ' || mgr.last_name AS leader_name,
  mgr.work_email                          AS leader_work_email,
  mgr.personal_email                      AS leader_personal_email
FROM public.leave_requests lr
JOIN public.employees emp ON emp.id = lr.employee_id
LEFT JOIN public.employees mgr ON mgr.id = lr.leader_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.time_off_email_logs tel
  WHERE tel.leave_request_id = lr.id
    AND tel.template_key = 'time_off_leader_notification'
)
ORDER BY lr.created_at DESC
LIMIT 50;

-- 3. Email log entries that have errors (failed sends)
SELECT
  tel.created_at,
  tel.recipient_email,
  tel.template_key,
  tel.error,
  tel.leave_request_id
FROM public.time_off_email_logs tel
WHERE tel.error IS NOT NULL
ORDER BY tel.created_at DESC
LIMIT 50;
