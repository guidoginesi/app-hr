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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/team/time-off/requests/[id]/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
