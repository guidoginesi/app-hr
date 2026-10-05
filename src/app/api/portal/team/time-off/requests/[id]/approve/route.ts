import { NextRequest, NextResponse, after } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';

// PUT /api/portal/team/time-off/requests/[id]/approve - Approve a team member's leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee || !auth.isLeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const leader = auth.employee;

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Get the request, junto con el empleado (para validar que es reporte directo
    // y para el mail) y el tipo de licencia, en una sola ida. El hint de la FK es
    // obligatorio: leave_requests tiene 4 FK a employees.
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select(
        '*, employee:employees!leave_requests_employee_id_fkey(manager_id, status, first_name, last_name, personal_email, work_email, user_id), leave_type:leave_types(name, count_type)'
      )
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verify the employee is a direct report: misma regla que getDirectReports
    // (manager_id = el líder y empleado activo)
    const employeeData = request.employee;
    if (!employeeData || employeeData.manager_id !== leader.id || employeeData.status !== 'active') {
      return NextResponse.json(
        { error: 'No tienes permiso para aprobar esta solicitud' },
        { status: 403 }
      );
    }

    // Can only approve pending_leader requests (or legacy 'pending')
    if (request.status !== 'pending_leader' && request.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar solicitudes pendientes de aprobación del líder' },
        { status: 400 }
      );
    }

    // Update the request - move to pending_hr (awaiting HR approval)
    // Note: We DON'T move days to used_days yet - that happens when HR approves
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'pending_hr',
        leader_approved_at: new Date().toISOString(),
        // Also update legacy fields for backward compatibility
        approved_by: leader.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Note: Balance stays in pending_days until HR approves
    // No balance update needed at this stage

    // Mails y notificaciones: corren después de responder (after), así el líder
    // no espera la búsqueda de destinatarios y en Vercel los envíos no se cortan
    const leaveType = request.leave_type;
    after(async () => {
      try {
        // Send email notifications
        const formatDate = (date: string) => {
          return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
        };

        // Se esperan todos los envíos al final, así after() mantiene viva la función
        const envios: Promise<unknown>[] = [];

        const employeeEmail = employeeData.work_email || employeeData.personal_email;
        const emailVariables = {
          nombre: employeeData.first_name,
          fecha_inicio: formatDate(request.start_date),
          fecha_fin: formatDate(request.end_date),
          cantidad_dias: String(request.days_requested),
          unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
          tipo_licencia: leaveType?.name || 'Licencia',
        };

        // Email to employee: approved by leader
        if (employeeEmail) {
          envios.push(sendTimeOffEmail({
            templateKey: 'time_off_approved_leader',
            to: employeeEmail,
            variables: emailVariables,
            leaveRequestId: id,
          }).catch((err) => console.error('Error sending leader approved email:', err)));
        }

        // Email to HR: pending HR approval
        // Get HR admins to notify
        const { data: admins } = await supabase
          .from('admins')
          .select('user_id')
          .limit(5);

        if (admins && admins.length > 0) {
          const adminUserIds = admins.map((a) => a.user_id);
          const { data: hrEmployees } = await supabase
            .from('employees')
            .select('personal_email, work_email')
            .in('user_id', adminUserIds);

          for (const hr of hrEmployees || []) {
            const hrEmail = hr.work_email || hr.personal_email;
            if (hrEmail) {
              envios.push(sendTimeOffEmail({
                templateKey: 'time_off_hr_notification',
                to: hrEmail,
                variables: {
                  nombre_colaborador: `${employeeData.first_name} ${employeeData.last_name}`,
                  nombre_lider: `${leader.first_name} ${leader.last_name}`,
                  ...emailVariables,
                },
                leaveRequestId: id,
              }).catch((err) => console.error('Error sending HR notification email:', err)));
            }
          }

          // In-app notification to HR admins
          envios.push(createSystemNotification({
            userIds: adminUserIds,
            title: 'Solicitud de licencia pendiente de aprobación',
            body: `${employeeData.first_name} ${employeeData.last_name} tiene una solicitud aprobada por su líder que requiere tu aprobación final.`,
            priority: 'info',
            deepLink: '/admin/time-off/requests',
            metadata: { entity_type: 'leave_request', entity_id: id },
            dedupeKey: `leave_request:${id}:pending_hr`,
          }).catch((err) => console.error('Error creating HR in-app notification:', err)));
        }

        // In-app notification to employee: approved by leader
        if (employeeData.user_id) {
          envios.push(createSystemNotification({
            userIds: [employeeData.user_id],
            title: 'Solicitud aprobada por tu líder',
            body: `Tu solicitud de ${leaveType?.name ?? 'licencia'} fue aprobada por tu líder. Pendiente de aprobación final de HR.`,
            priority: 'info',
            deepLink: '/portal/time-off',
            metadata: { entity_type: 'leave_request', entity_id: id },
            dedupeKey: `leave_request:${id}:approved_leader`,
          }).catch((err) => console.error('Error creating employee in-app notification:', err)));
        }

        await Promise.all(envios);
      } catch (err) {
        console.error('Error sending leader approval notifications:', err);
      }
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/team/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
