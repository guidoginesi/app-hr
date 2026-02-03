import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

// Regex for UUID format (more permissive than RFC 4122)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AddBonusDaysSchema = z.object({
  employee_id: z.string().regex(uuidRegex, 'ID de empleado inválido'),
  leave_type_id: z.string().regex(uuidRegex, 'ID de tipo de licencia inválido'),
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
    console.log('[Bonus Days] Received request body:', JSON.stringify(body));
    
    const parsed = AddBonusDaysSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[Bonus Days] Validation failed:', parsed.error.issues);
      return NextResponse.json(
        { error: parsed.error.issues.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { employee_id, leave_type_id, year, days, reason } = parsed.data;
    const supabase = getSupabaseServer();

    // Verify employee exists
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      console.error('[Bonus Days] Employee not found:', employee_id, empError);
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Get current balance (or create if it doesn't exist)
    let { data: currentBalance, error: fetchError } = await supabase
      .from('leave_balances')
      .select('id, bonus_days')
      .eq('employee_id', employee_id)
      .eq('leave_type_id', leave_type_id)
      .eq('year', year)
      .single();

    // If balance doesn't exist, create it
    if (fetchError || !currentBalance) {
      console.log('[Bonus Days] Balance not found, creating new one for employee:', employee_id);
      const { data: newBalance, error: createError } = await supabase
        .from('leave_balances')
        .insert({
          employee_id,
          leave_type_id,
          year,
          entitled_days: 0,
          used_days: 0,
          pending_days: 0,
          carried_over: 0,
          bonus_days: 0,
        })
        .select('id, bonus_days')
        .single();

      if (createError || !newBalance) {
        console.error('[Bonus Days] Failed to create balance:', createError);
        return NextResponse.json(
          { error: 'No se pudo crear el balance para este empleado/año/tipo' },
          { status: 500 }
        );
      }
      currentBalance = newBalance;
    }

    // Get admin employee ID
    const { data: adminEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('user_id', user.id)
      .single();

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

    // Record the bonus adjustment for tracking
    const { data: adjustmentData, error: adjustmentError } = await supabase
      .from('bonus_adjustments')
      .insert({
        employee_id,
        leave_type_id,
        year,
        days,
        reason,
        status: 'active',
        created_by: adminEmployee?.id || null,
      })
      .select('id')
      .single();

    if (adjustmentError) {
      // Log but don't fail - the balance was already updated
      console.error('[Bonus Days] Failed to record adjustment:', adjustmentError);
    } else {
      console.log('[Bonus Days] Adjustment recorded with ID:', adjustmentData?.id);
    }

    console.log(`[Bonus Days] Added ${days} days to employee ${employee_id}, type ${leave_type_id}, year ${year}. Reason: ${reason}. Admin: ${user.email}`);

    // Get leave type name for response
    const { data: leaveType } = await supabase
      .from('leave_types')
      .select('name')
      .eq('id', leave_type_id)
      .single();

    return NextResponse.json({
      success: true,
      message: `Se agregaron ${days} día(s) de ${leaveType?.name || 'bonificación'} a ${employee.first_name} ${employee.last_name}`,
      balance: data,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/time-off/balances/bonus:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
