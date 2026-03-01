import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/send - Bulk send for a period
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin, user } = await requireAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Verify period exists
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    // Get READY_TO_SEND settlements
    const { data: settlements, error: fetchError } = await supabase
      .from('payroll_employee_settlements')
      .select('id, email_to')
      .eq('period_id', id)
      .eq('status', 'READY_TO_SEND');

    if (fetchError) {
      console.error('Error fetching settlements for send:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!settlements || settlements.length === 0) {
      return NextResponse.json(
        { sent_count: 0, errors: [], message: 'No hay liquidaciones listas para enviar' }
      );
    }

    let sentCount = 0;
    const errors: { settlement_id: string; error: string }[] = [];

    for (const settlement of settlements) {
      const { error: updateError } = await supabase
        .from('payroll_employee_settlements')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          sent_by: user.id,
          email_to: settlement.email_to,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlement.id);

      if (updateError) {
        console.error(`Error sending settlement ${settlement.id}:`, updateError);
        errors.push({ settlement_id: settlement.id, error: updateError.message });
      } else {
        sentCount++;
      }
    }

    return NextResponse.json({ sent_count: sentCount, errors });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/send:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
