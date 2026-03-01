import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail, logTimeOffEmail } from '@/lib/emailService';

// POST /api/admin/time-off/requests/[id]/resend-notification
// Reenvía el email de notificación al líder para una solicitud específica.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Fetch the leave request with employee details
    const { data: request, error: reqError } = await supabase
      .from('leave_requests')
      .select(`
        id, status, start_date, end_date, days_requested, notes, leader_id,
        employee:employee_id (
          id, first_name, last_name, work_email, personal_email
        ),
        leave_type:leave_type_id (
          id, name
        )
      `)
      .eq('id', id)
      .single();

    if (reqError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (!request.leader_id) {
      return NextResponse.json(
        { error: 'Esta solicitud no tiene líder asignado' },
        { status: 400 }
      );
    }

    // Fetch leader details
    const { data: leader } = await supabase
      .from('employees')
      .select('id, first_name, last_name, work_email, personal_email, user_id')
      .eq('id', request.leader_id)
      .single();

    if (!leader) {
      return NextResponse.json(
        { error: 'No se encontró el empleado líder en la base de datos' },
        { status: 404 }
      );
    }

    // Resolve email with fallback to auth account
    let leaderEmail: string | null = leader.work_email || leader.personal_email;

    if (!leaderEmail && leader.user_id) {
      const { data: authUser } = await supabase.auth.admin.getUserById(leader.user_id);
      if (authUser?.user?.email) {
        leaderEmail = authUser.user.email;
      }
    }

    if (!leaderEmail) {
      await logTimeOffEmail({
        leaveRequestId: id,
        recipientEmail: 'unknown',
        templateKey: 'time_off_leader_notification',
        subject: 'ERROR: resend failed - no email',
        body: '',
        error: `leader_id=${request.leader_id} has no email in employees or auth`,
      });
      return NextResponse.json(
        { error: `El líder ${leader.first_name} ${leader.last_name} no tiene ningún email configurado` },
        { status: 422 }
      );
    }

    const employee = request.employee as any;
    const leaveType = request.leave_type as any;

    const formatDate = (date: string) =>
      new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    const result = await sendTimeOffEmail({
      templateKey: 'time_off_leader_notification',
      to: leaderEmail,
      variables: {
        nombre_lider: leader.first_name,
        nombre_colaborador: `${employee.first_name} ${employee.last_name}`,
        nombre: employee.first_name,
        fecha_inicio: formatDate(request.start_date),
        fecha_fin: formatDate(request.end_date),
        cantidad_dias: String(request.days_requested),
        tipo_licencia: leaveType?.name ?? 'Licencia',
      },
      leaveRequestId: id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Error al enviar el email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Email reenviado a ${leaderEmail}`,
    });
  } catch (error: any) {
    console.error('[resend-notification] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
