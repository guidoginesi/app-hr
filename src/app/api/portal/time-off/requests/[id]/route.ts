import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET /api/portal/time-off/requests/[id] - Get a specific request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('leave_requests_with_details')
      .select('*')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET /api/portal/time-off/requests/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/portal/time-off/requests/[id] - Cancel my request (only if pending)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseServer();

    // Get the request first
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .eq('employee_id', auth.employee.id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Can only cancel requests that are not in a final state
    const cancellableStatuses = ['pending', 'pending_leader', 'pending_hr'];
    if (!cancellableStatuses.includes(request.status)) {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar solicitudes que aún no han sido aprobadas o rechazadas' },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      console.error('Error cancelling leave request:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Restore pending days in balance
    const startYear = new Date(request.start_date).getFullYear();
    const { data: balance } = await supabase
      .from('leave_balances')
      .select('pending_days')
      .eq('employee_id', auth.employee.id)
      .eq('leave_type_id', request.leave_type_id)
      .eq('year', startYear)
      .single();

    if (balance) {
      await supabase
        .from('leave_balances')
        .update({
          pending_days: Math.max(0, balance.pending_days - request.days_requested),
        })
        .eq('employee_id', auth.employee.id)
        .eq('leave_type_id', request.leave_type_id)
        .eq('year', startYear);
    }

    // Delete remote work weeks if applicable
    await supabase.from('remote_work_weeks').delete().eq('leave_request_id', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/portal/time-off/requests/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
