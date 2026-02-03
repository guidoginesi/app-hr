import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const CancelBonusSchema = z.object({
  cancellation_reason: z.string().min(1, 'El motivo de cancelación es requerido').max(500),
});

// PUT /api/admin/time-off/bonus-adjustments/[id]/cancel - Cancel a bonus adjustment
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
    console.log('[Cancel Bonus] Attempting to cancel adjustment:', id);
    
    const body = await req.json();
    const parsed = CancelBonusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { cancellation_reason } = parsed.data;
    const supabase = getSupabaseServer();

    // Get the adjustment details
    const { data: adjustment, error: fetchError } = await supabase
      .from('bonus_adjustments')
      .select('*')
      .eq('id', id)
      .single();

    console.log('[Cancel Bonus] Fetch result:', { adjustment, fetchError });

    if (fetchError || !adjustment) {
      console.error('[Cancel Bonus] Adjustment not found:', id, fetchError);
      return NextResponse.json(
        { error: 'Ajuste no encontrado' },
        { status: 404 }
      );
    }

    if (adjustment.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Este ajuste ya fue cancelado' },
        { status: 400 }
      );
    }

    // Get admin employee ID
    const { data: adminEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Get current balance
    const { data: balance, error: balanceError } = await supabase
      .from('leave_balances')
      .select('id, bonus_days')
      .eq('employee_id', adjustment.employee_id)
      .eq('leave_type_id', adjustment.leave_type_id)
      .eq('year', adjustment.year)
      .single();

    if (balanceError || !balance) {
      return NextResponse.json(
        { error: 'No se encontró el balance asociado' },
        { status: 404 }
      );
    }

    // Revert the bonus days (subtract what was added)
    const newBonusDays = (balance.bonus_days || 0) - adjustment.days;

    // Update balance
    const { error: updateBalanceError } = await supabase
      .from('leave_balances')
      .update({
        bonus_days: newBonusDays,
        updated_at: new Date().toISOString(),
      })
      .eq('id', balance.id);

    if (updateBalanceError) {
      console.error('Error updating balance:', updateBalanceError);
      return NextResponse.json(
        { error: 'Error al actualizar el balance' },
        { status: 500 }
      );
    }

    // Mark adjustment as cancelled
    const { error: cancelError } = await supabase
      .from('bonus_adjustments')
      .update({
        status: 'cancelled',
        cancelled_by: adminEmployee?.id || null,
        cancelled_at: new Date().toISOString(),
        cancellation_reason,
      })
      .eq('id', id);

    if (cancelError) {
      console.error('Error cancelling adjustment:', cancelError);
      return NextResponse.json(
        { error: 'Error al cancelar el ajuste' },
        { status: 500 }
      );
    }

    // Get leave type name and employee name for response
    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('name')
      .eq('id', adjustment.leave_type_id)
      .single();

    const { data: employee } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', adjustment.employee_id)
      .single();

    const employeeName = employee 
      ? `${employee.first_name} ${employee.last_name}`
      : 'empleado';

    console.log(`[Bonus Days] Cancelled adjustment ${id}: ${adjustment.days} days reverted for employee ${adjustment.employee_id}. Reason: ${cancellation_reason}. Admin: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: `Se canceló el ajuste de ${adjustment.days} día(s) de ${leaveType?.name || 'bonus'} para ${employeeName}`,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/admin/time-off/bonus-adjustments/[id]/cancel:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
