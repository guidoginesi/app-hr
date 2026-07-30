import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { applyAdvancesToPeriod } from '@/lib/payrollAdvances';

type RouteContext = { params: Promise<{ id: string }> };

async function loadPeriod(supabase: ReturnType<typeof getSupabaseServer>, id: string) {
  const { data } = await supabase
    .from('payroll_periods')
    .select('id, year, month, period_type, status')
    .eq('id', id)
    .single();
  return data;
}

// GET — adelantos que impactan en este período (mes)
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const supabase = getSupabaseServer();
    const period = await loadPeriod(supabase, id);
    if (!period) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });

    const { data, error } = await supabase
      .from('salary_advances_with_details')
      .select('id, employee_name, employment_type, amount, status, applied_period_id')
      .eq('discount_year', period.year)
      .eq('discount_month', period.month)
      .in('status', ['approved', 'transferred', 'settled'])
      .order('employee_name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const advances = (data ?? []).map((a) => ({
      ...a,
      // monotributo = descuento computado; dependencia = informado
      mode: a.employment_type === 'dependency' ? 'informado' : 'computado',
      applied: a.applied_period_id === period.id,
    }));

    return NextResponse.json({ advances, period_type: period.period_type });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — (re)aplicar los adelantos pendientes del mes a este período
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const supabase = getSupabaseServer();
    const period = await loadPeriod(supabase, id);
    if (!period) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });

    const { applied } = await applyAdvancesToPeriod(supabase, period);
    return NextResponse.json({ success: true, applied });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
