import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess, getDirectReports } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';

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

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verify the employee is a direct report
    const directReports = await getDirectReports(auth.employee.id);
    const directReportIds = directReports.map((e) => e.id);

    if (!directReportIds.includes(request.employee_id)) {
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
        approved_by: auth.employee.id,
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

    // Send email notifications
    const formatDate = (date: string) => {
      return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    // Get employee and leave type details for email
    const { data: employeeData } = await supabase
      .from('employees')
      .select('first_name, last_name, personal_email, work_email')
      .eq('id', request.employee_id)
      .single();

    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('name, count_type')
      .eq('id', request.leave_type_id)
      .single();

    if (employeeData) {
      const employeeEmail = employeeData.work_email || employeeData.personal_email;
      const emailVariables = {
        nombre: employeeData.first_name,
        fecha_inicio: formatDate(request.start_date),
        fecha_fin: formatDate(request.end_date),
        cantidad_dias: String(request.days_requested),
        unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semanas' : 'días',
        tipo_licencia: leaveType?.name || 'Licencia',
      };

      // Email to employee: approved by leader
      if (employeeEmail) {
        sendTimeOffEmail({
          templateKey: 'time_off_approved_leader',
          to: employeeEmail,
          variables: emailVariables,
          leaveRequestId: id,
        }).catch((err) => console.error('Error sending leader approved email:', err));
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
            sendTimeOffEmail({
              templateKey: 'time_off_hr_notification',
              to: hrEmail,
              variables: {
                nombre_colaborador: `${employeeData.first_name} ${employeeData.last_name}`,
                nombre_lider: `${auth.employee.first_name} ${auth.employee.last_name}`,
                ...emailVariables,
              },
              leaveRequestId: id,
            }).catch((err) => console.error('Error sending HR notification email:', err));
          }
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/team/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
