import { NextRequest, NextResponse, after } from 'next/server';
import { requireAdminConLegajo } from '@/lib/adminTimeOffAcciones';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';
import { isUnlimitedLeaveType } from '@/lib/leaveTypes';
import { sincronizarLicencia } from '@/lib/leaveCalendar';

// PUT /api/admin/time-off/requests/[id]/approve - HR Admin approves a leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServer();

    // El chequeo de admin (que ya trae el legajo de quien aprueba) y la
    // solicitud no dependen uno del otro: van en paralelo. La solicitud viene
    // con el tipo de licencia y el empleado en la misma ida; el hint de la FK es
    // obligatorio porque leave_requests tiene 4 FK a employees. No se usa nada
    // de la solicitud antes de confirmar que es admin.
    const [{ isAdmin, user, adminEmployee }, { data: request, error: fetchError }] =
      await Promise.all([
        requireAdminConLegajo(),
        supabase
          .from('leave_requests')
          .select(
            '*, leave_type:leave_types(code, name, count_type), employee:employees!leave_requests_employee_id_fkey(first_name, personal_email, work_email, user_id)'
          )
          .eq('id', id)
          .single(),
      ]);

    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // HR can approve any pending request (pending, pending_leader, or pending_hr)
    const pendingStatuses = ['pending', 'pending_leader', 'pending_hr'];
    if (!pendingStatuses.includes(request.status)) {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar solicitudes pendientes' },
        { status: 400 }
      );
    }

    // Update the request - final approval
    const updateData: Record<string, unknown> = {
      status: 'approved',
      hr_approved_by: adminEmployee?.id || null,
      hr_approved_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    };

    // If skipping leader approval, also set leader fields
    if (request.status === 'pending_leader' || request.status === 'pending') {
      updateData.leader_id = adminEmployee?.id || null;
      updateData.leader_approved_at = new Date().toISOString();
    }

    // Balance: move from pending to used (skip for unlimited types)
    const leaveType = request.leave_type;
    const tracksBalance = !leaveType || !isUnlimitedLeaveType(leaveType.code);
    const startYear = new Date(request.start_date).getFullYear();

    // El saldo se LEE en paralelo con el update de la solicitud, pero se
    // ESCRIBE recién cuando el update salió bien: si falla, el saldo no se mueve.
    // El update sólo toca la fila si sigue pendiente: entre la lectura y acá
    // otra aprobación o un rechazo pudo cerrarla, y si no vuelve ninguna fila
    // se responde como si ya no estuviera pendiente, sin mover el saldo.
    const [{ data, error }, { data: balance }] = await Promise.all([
      supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id)
        .in('status', pendingStatuses)
        .select()
        .maybeSingle(),
      tracksBalance
        ? supabase
            .from('leave_balances')
            .select('pending_days, used_days')
            .eq('employee_id', request.employee_id)
            .eq('leave_type_id', request.leave_type_id)
            .eq('year', startYear)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (error) {
      console.error('Error approving leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar solicitudes pendientes' },
        { status: 400 }
      );
    }

    if (balance) {
      await supabase
        .from('leave_balances')
        .update({
          pending_days: Math.max(0, balance.pending_days - request.days_requested),
          used_days: balance.used_days + request.days_requested,
        })
        .eq('employee_id', request.employee_id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', startYear);
    }

    // Calendario, mail y aviso: corren después de responder (after), así RRHH
    // no los espera y en Vercel no se cortan al congelarse la función. Los datos
    // del empleado y del tipo de licencia ya vinieron con la solicitud.
    const employeeData = request.employee;
    after(async () => {
      // El evento en el calendario del equipo. Si Google falla, la licencia
      // igual quedó aprobada.
      const envios: Promise<unknown>[] = [
        sincronizarLicencia(id).catch((err) => console.error('[calendar] al aprobar:', err)),
      ];

      // Send email notification to employee
      const formatDate = (date: string) => {
        return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      if (employeeData) {
        const employeeEmail = employeeData.work_email || employeeData.personal_email;
        if (employeeEmail) {
          envios.push(
            sendTimeOffEmail({
              templateKey: 'time_off_approved_hr',
              to: employeeEmail,
              variables: {
                nombre: employeeData.first_name,
                fecha_inicio: formatDate(request.start_date),
                fecha_fin: formatDate(request.end_date),
                cantidad_dias: String(request.days_requested),
                unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
                tipo_licencia: leaveType?.name || 'Licencia',
              },
              leaveRequestId: id,
            }).catch((err) => console.error('Error sending HR approved email:', err))
          );
        }
      }

      // In-app notification to employee: final approval
      if (employeeData?.user_id) {
        envios.push(
          createSystemNotification({
            userIds: [employeeData.user_id],
            title: '¡Solicitud de licencia aprobada!',
            body: `Tu solicitud de ${leaveType?.name ?? 'licencia'} fue aprobada definitivamente. ¡Que lo disfrutes!`,
            priority: 'info',
            deepLink: '/portal/time-off',
            metadata: { entity_type: 'leave_request', entity_id: id },
            dedupeKey: `leave_request:${id}:approved_final`,
          }).catch((err) => console.error('Error creating final approval in-app notification:', err))
        );
      }

      await Promise.all(envios);
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
