import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';

const CancelSchema = z.object({
  cancellation_reason: z.string().min(1, 'El motivo de cancelación es requerido'),
});

// PUT /api/admin/time-off/requests/[id]/cancel - HR Admin cancels an approved leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = CancelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();

    // Get admin's employee record (optional - may be null)
    const { data: adminEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Can only cancel approved requests
    if (request.status !== 'approved') {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar solicitudes aprobadas' },
        { status: 400 }
      );
    }

    // Check that the request hasn't started yet
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(request.start_date);
    
    if (startDate <= today) {
      return NextResponse.json(
        { error: 'No se pueden cancelar solicitudes que ya iniciaron o están en curso' },
        { status: 400 }
      );
    }

    // Update the request to cancelled
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'cancelled',
        rejection_reason: parsed.data.cancellation_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update balance: restore used days back to available
    const startYear = new Date(request.start_date).getFullYear();
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('used_days')
      .eq('employee_id', request.employee_id)
      .eq('leave_type_id', request.leave_type_id)
      .eq('year', startYear)
      .single();

    if (balance) {
      const { error: balanceError } = await supabase
        .from('leave_balances')
        .update({
          used_days: Math.max(0, balance.used_days - request.days_requested),
        })
        .eq('employee_id', request.employee_id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', startYear);

      if (balanceError) {
        console.error('Error restoring balance:', balanceError);
      } else {
        console.log(`Balance restored: ${request.days_requested} days returned to employee ${request.employee_id}`);
      }
    }

    // Delete remote work weeks if applicable
    await supabase.from('remote_work_weeks').delete().eq('leave_request_id', id);

    // Send email notification to employee
    const formatDate = (date: string) => {
      return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const { data: employeeData } = await supabase
      .from('employees')
      .select('first_name, personal_email, work_email')
      .eq('id', request.employee_id)
      .single();

    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('name')
      .eq('id', request.leave_type_id)
      .single();

    if (employeeData) {
      const employeeEmail = employeeData.work_email || employeeData.personal_email;
      if (employeeEmail) {
        sendTimeOffEmail({
          templateKey: 'time_off_modified',
          to: employeeEmail,
          variables: {
            nombre: employeeData.first_name,
            fecha_inicio: formatDate(request.start_date),
            fecha_fin: formatDate(request.end_date),
            cantidad_dias: String(request.days_requested),
            tipo_licencia: leaveType?.name || 'Licencia',
            tipo_cambio: 'cancelada',
          },
          leaveRequestId: id,
        }).catch((err) => console.error('Error sending cancellation email:', err));
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]/cancel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
