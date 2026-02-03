import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { sendTimeOffEmail } from '@/lib/emailService';

// PUT /api/admin/time-off/requests/[id]/approve - HR Admin approves a leave request
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

    const { data, error } = await supabase
      .from('leave_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update balance: move from pending to used
    const startYear = new Date(request.start_date).getFullYear();
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('pending_days, used_days')
      .eq('employee_id', request.employee_id)
      .eq('leave_type_id', request.leave_type_id)
      .eq('year', startYear)
      .single();

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
          templateKey: 'time_off_approved_hr',
          to: employeeEmail,
          variables: {
            nombre: employeeData.first_name,
            fecha_inicio: formatDate(request.start_date),
            fecha_fin: formatDate(request.end_date),
            cantidad_dias: String(request.days_requested),
            tipo_licencia: leaveType?.name || 'Licencia',
          },
          leaveRequestId: id,
        }).catch((err) => console.error('Error sending HR approved email:', err));
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
