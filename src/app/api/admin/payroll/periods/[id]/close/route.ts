import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { settlePeriodAdvances } from '@/lib/payrollAdvances';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/close - Close period (any non-CLOSED status)
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    const { data: period, error: fetchError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    if (period.status === 'CLOSED') {
      return NextResponse.json({ error: 'El período ya está cerrado' }, { status: 400 });
    }

    const { data: updatedPeriod, error: updateError } = await supabase
      .from('payroll_periods')
      .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fase 3: marcar saldados los adelantos descontados en este período
    let settledAdvances = 0;
    try {
      const r = await settlePeriodAdvances(supabase, id);
      settledAdvances = r.settled;
    } catch (e) {
      console.error('[Payroll] settlePeriodAdvances on close failed:', e);
    }

    return NextResponse.json({
      period: updatedPeriod,
      settled_advances: settledAdvances,
      message: 'Período cerrado correctamente',
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/close:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
