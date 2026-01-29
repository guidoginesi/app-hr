import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const RejectSchema = z.object({
  rejection_reason: z.string().min(1, 'El motivo de rechazo es requerido'),
});

// PUT /api/admin/time-off/requests/[id]/reject - HR Admin rejects a leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get admin's employee record (optional - may be null)
    const supabaseForEmployee = getSupabaseServer();
    const { data: adminEmployee } = await supabaseForEmployee
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

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

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

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

    // Update the request - rejected by HR (final state)
    const { data, error } = await supabase
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
      .select()
      .single();

    if (error) {
      console.error('Error rejecting leave request:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update balance: remove from pending
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

    // Delete remote work weeks if applicable
    await supabase.from('remote_work_weeks').delete().eq('leave_request_id', id);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/requests/[id]/reject:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
