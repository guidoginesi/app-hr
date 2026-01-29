import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

const AddBonusDaysSchema = z.object({
  employee_id: z.string().uuid('ID de empleado inválido'),
  leave_type_id: z.string().uuid('ID de tipo de licencia inválido'),
  year: z.number().int().min(2020).max(2100),
  days: z.number().min(0.5, 'Mínimo 0.5 días').max(30, 'Máximo 30 días'),
  reason: z.string().min(1, 'El motivo es requerido').max(500),
});

// POST /api/admin/time-off/balances/bonus - Add bonus days to an employee
export async function POST(req: NextRequest) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = AddBonusDaysSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { employee_id, leave_type_id, year, days, reason } = parsed.data;
    const supabase = getSupabaseServer();

    // Get current balance
    const { data: currentBalance, error: fetchError } = await supabase
      .from('leave_balances')
      .select('id, bonus_days')
      .eq('employee_id', employee_id)
      .eq('leave_type_id', leave_type_id)
      .eq('year', year)
      .single();

    if (fetchError || !currentBalance) {
      return NextResponse.json(
        { error: 'No se encontró el balance para este empleado/año/tipo' },
        { status: 404 }
      );
    }

    // Update bonus days
    const newBonusDays = (currentBalance.bonus_days || 0) + days;

    const { data, error } = await supabase
      .from('leave_balances')
      .update({
        bonus_days: newBonusDays,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentBalance.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating bonus days:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log the bonus addition (optional - could create an audit table later)
    console.log(`[Bonus Days] Added ${days} days to employee ${employee_id}, type ${leave_type_id}, year ${year}. Reason: ${reason}. Admin: ${user.email}`);

    // Get employee and leave type names for response
    const { data: employee } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', employee_id)
      .single();

    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('name')
      .eq('id', leave_type_id)
      .single();

    return NextResponse.json({
      success: true,
      message: `Se agregaron ${days} día(s) de ${leaveType?.name || 'bonificación'} a ${employee?.first_name} ${employee?.last_name}`,
      balance: data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/time-off/balances/bonus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
