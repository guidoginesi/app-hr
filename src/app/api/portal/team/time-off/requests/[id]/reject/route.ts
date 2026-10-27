import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';
import { isUnlimitedLeaveType } from '@/lib/leaveTypes';

const RejectSchema = z.object({
  rejection_reason: z.string().min(1, 'El motivo de rechazo es requerido'),
});

// PUT /api/portal/team/time-off/requests/[id]/reject - Reject a team member's leave request
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
    const body = await req.json();
    const parsed = RejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get the request, junto con el empleado (para validar que es reporte directo
    // y para el mail) y el tipo de licencia (para el saldo y el mail), en una sola
    // ida. El hint de la FK es obligatorio: leave_requests tiene 4 FK a employees.
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select(
        '*, employee:employees!leave_requests_employee_id_fkey(manager_id, status, first_name, personal_email, work_email, user_id), leave_type:leave_types(code, name, count_type)'
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
        { error: 'No tienes permiso para rechazar esta solicitud' },
        { status: 403 }
      );
    }

    // Can only reject pending_leader requests (or legacy 'pending')
    if (request.status !== 'pending_leader' && request.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo se pueden rechazar solicitudes pendientes de aprobación del líder' },
        { status: 400 }
      );
    }

    // Update the request - set to rejected_leader (final state)
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected_leader',
        leader_rejection_reason: parsed.data.rejection_reason,
        // Also update legacy fields for backward compatibility
        approved_by: leader.id,
        approved_at: new Date().toISOString(),
        rejection_reason: parsed.data.rejection_reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Saldo y semanas remotas: después del update de la solicitud, y entre sí
    // son independientes, así que van en paralelo
    const leaveType = request.leave_type;
    const releasePendingDays = async () => {
      if (leaveType && isUnlimitedLeaveType(leaveType.code)) return;
      const startYear = new Date(request.start_date).getFullYear();
      const { data: balance } = await supabase
        .from('leave_balances')
        .select('pending_days')
        .eq('employee_id', request.employee_id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', startYear)
        .single();

      if (balance) {
        await supabase
          .from('leave_balances')
          .update({
            pending_days: Math.max(0, balance.pending_days - request.days_requested),
          })
          .eq('employee_id', request.employee_id)
          .eq('leave_type_id', request.leave_type_id)
          .eq('year', startYear);
      }
    };

    await Promise.all([
      releasePendingDays(),
      // Delete remote work weeks if applicable
      supabase.from('remote_work_weeks').delete().eq('leave_request_id', id),
    ]);

    // Mail y notificación al empleado: corren después de responder (after)
    after(async () => {
      try {
        // Send email notification to employee
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
        if (employeeEmail) {
          envios.push(sendTimeOffEmail({
            templateKey: 'time_off_rejected',
            to: employeeEmail,
            variables: {
              nombre: employeeData.first_name,
              fecha_inicio: formatDate(request.start_date),
              fecha_fin: formatDate(request.end_date),
              cantidad_dias: String(request.days_requested),
              unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
              tipo_licencia: leaveType?.name || 'Licencia',
              comentario: parsed.data.rejection_reason,
              rechazado_por: `${leader.first_name} ${leader.last_name}`,
            },
            leaveRequestId: id,
          }).catch((err) => console.error('Error sending rejection email:', err)));
        }

        // In-app notification to employee: rejected by leader
        if (employeeData.user_id) {
          envios.push(createSystemNotification({
            userIds: [employeeData.user_id],
            title: 'Solicitud de licencia rechazada',
            body: `Tu solicitud de ${leaveType?.name ?? 'licencia'} fue rechazada por tu líder. Motivo: ${parsed.data.rejection_reason}`,
            priority: 'warning',
            deepLink: '/portal/time-off',
            metadata: { entity_type: 'leave_request', entity_id: id },
            dedupeKey: `leave_request:${id}:rejected_leader`,
          }).catch((err) => console.error('Error creating rejection in-app notification:', err)));
        }

        await Promise.all(envios);
      } catch (err) {
        console.error('Error sending leader rejection notifications:', err);
      }
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/team/time-off/requests/[id]/reject:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
