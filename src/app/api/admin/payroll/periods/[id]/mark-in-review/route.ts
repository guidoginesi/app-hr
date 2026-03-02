import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/payroll/periods/[id]/mark-in-review - Transition period DRAFT → IN_REVIEW
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

    if (period.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `El período está en estado "${period.status}" y no puede pasarse a revisión` },
        { status: 400 }
      );
    }

    const { data: updatedPeriod, error: updateError } = await supabase
      .from('payroll_periods')
      .update({ status: 'IN_REVIEW', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      period: updatedPeriod,
      message: 'Período marcado como En Revisión',
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/payroll/periods/[id]/mark-in-review:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
