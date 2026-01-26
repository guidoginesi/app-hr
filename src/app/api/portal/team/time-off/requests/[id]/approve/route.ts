import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess, getDirectReports } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

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

    // Can only approve pending requests
    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar solicitudes pendientes' },
        { status: 400 }
      );
    }

    // Update the request
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: auth.employee.id,
        approved_at: new Date().toISOString(),
      })
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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/team/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
