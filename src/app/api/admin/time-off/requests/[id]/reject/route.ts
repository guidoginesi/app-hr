import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { requireAdminConLegajo } from '@/lib/adminTimeOffAcciones';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';
import { createSystemNotification } from '@/lib/notificationService';
import { isUnlimitedLeaveType } from '@/lib/leaveTypes';

const RejectSchema = z.object({
  rejection_reason: z.string().min(1, 'El motivo de rechazo es requerido'),
});

// PUT /api/admin/time-off/requests/[id]/reject - HR Admin rejects a leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServer();

    // El chequeo de admin (que ya trae el legajo de quien rechaza) y la
    // solicitud no dependen uno del otro: van en paralelo. La solicitud viene
    // con el tipo de licencia y el empleado en la misma ida; el hint de la FK es
    // obligatorio porque leave_requests tiene 4 FK a employees. Las respuestas
    // de error salen en el mismo orden que antes: 401, 400 y 404.
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

    const body = await req.json();
    const parsed = RejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // HR can reject any pending request (pending, pending_leader, or pending_hr)
    const pendingStatuses = ['pending', 'pending_leader', 'pending_hr'];
    if (!pendingStatuses.includes(request.status)) {
      return NextResponse.json(
        { error: 'Solo se pueden rechazar solicitudes pendientes' },
        { status: 400 }
      );
    }

    const leaveType = request.leave_type;
    const tracksBalance = !leaveType || !isUnlimitedLeaveType(leaveType.code);
    const startYear = new Date(request.start_date).getFullYear();

    // Update the request - rejected by HR (final state). El saldo se LEE en
    // paralelo, pero se ESCRIBE recién cuando el update salió bien. El update
    // sólo toca la fila si sigue pendiente: entre la lectura y acá otra acción
    // pudo cerrarla, y si no vuelve ninguna fila se responde como si ya no
    // estuviera pendiente, sin liberar el saldo ni borrar semanas remotas.
    const [{ data, error }, { data: balance }] = await Promise.all([
      supabase
        .from('leave_requests')
        .update({
          status: 'rejected_hr',
          hr_approved_by: adminEmployee?.id || null,
          hr_approved_at: new Date().toISOString(),
          hr_rejection_reason: parsed.data.rejection_reason,
          // Also update legacy fields for backward compatibility
          approved_at: new Date().toISOString(),
          rejection_reason: parsed.data.rejection_reason,
        })
        .eq('id', id)
        .in('status', pendingStatuses)
        .select()
        .maybeSingle(),
      tracksBalance
        ? supabase
            .from('leave_balances')
            .select('pending_days')
            .eq('employee_id', request.employee_id)
            .eq('leave_type_id', request.leave_type_id)
            .eq('year', startYear)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    if (error) {
      console.error('Error rejecting leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Solo se pueden rechazar solicitudes pendientes' },
        { status: 400 }
      );
    }

    // Liberar los días pendientes y borrar las semanas remotas no dependen uno
    // del otro: van en paralelo, los dos después del update de la solicitud.
    await Promise.all([
      balance
        ? supabase
            .from('leave_balances')
            .update({
              pending_days: Math.max(0, balance.pending_days - request.days_requested),
            })
            .eq('employee_id', request.employee_id)
            .eq('leave_type_id', request.leave_type_id)
            .eq('year', startYear)
        : null,
      // Delete remote work weeks if applicable
      supabase.from('remote_work_weeks').delete().eq('leave_request_id', id),
    ]);

    // Mail y aviso: corren después de responder (after), así RRHH no los
    // espera y en Vercel no se cortan al congelarse la función. Los datos del
    // empleado y del tipo de licencia ya vinieron con la solicitud.
    const employeeData = request.employee;
    const rejectionReason = parsed.data.rejection_reason;
    after(async () => {
      const envios: Promise<unknown>[] = [];

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
              templateKey: 'time_off_rejected',
              to: employeeEmail,
              variables: {
                nombre: employeeData.first_name,
                fecha_inicio: formatDate(request.start_date),
                fecha_fin: formatDate(request.end_date),
                cantidad_dias: String(request.days_requested),
                unidad_tiempo: leaveType?.count_type === 'weeks' ? 'semana(s)' : 'día(s)',
                tipo_licencia: leaveType?.name || 'Licencia',
                comentario: rejectionReason,
                rechazado_por: 'Equipo de People',
              },
              leaveRequestId: id,
            }).catch((err) => console.error('Error sending HR rejection email:', err))
          );
        }
      }

      // In-app notification to employee: rejected by HR
      if (employeeData?.user_id) {
        envios.push(
          createSystemNotification({
            userIds: [employeeData.user_id],
            title: 'Solicitud de licencia rechazada',
            body: `Tu solicitud de ${leaveType?.name ?? 'licencia'} fue rechazada por HR. Motivo: ${rejectionReason}`,
            priority: 'warning',
            deepLink: '/portal/time-off',
            metadata: { entity_type: 'leave_request', entity_id: id },
            dedupeKey: `leave_request:${id}:rejected_hr`,
          }).catch((err) => console.error('Error creating HR rejection in-app notification:', err))
        );
      }

      await Promise.all(envios);
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]/reject:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
