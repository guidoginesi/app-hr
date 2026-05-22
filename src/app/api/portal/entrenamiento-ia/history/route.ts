import { NextRequest, NextResponse } from 'next/server';
import { requirePortalAccess } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePortalAccess();
    if (!auth?.employee) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycle_id');

    const supabase = getSupabaseServer();

    let activeCycleId = cycleId;
    if (!activeCycleId) {
      const { data: cycle } = await supabase
        .from('ai_training_cycles')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      activeCycleId = cycle?.id ?? null;
    }

    if (!activeCycleId) {
      return NextResponse.json({ history: [], cycle: null });
    }

    const { data: history, error } = await supabase
      .from('ai_training_score_details')
      .select('*')
      .eq('cycle_id', activeCycleId)
      .eq('employee_id', auth.employee.id)
      .order('session_date', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: cycle } = await supabase
      .from('ai_training_cycles')
      .select('*')
      .eq('id', activeCycleId)
      .single();

    const totalPoints = (history ?? []).reduce((sum, row) => sum + (row.total_points ?? 0), 0);

    return NextResponse.json({
      cycle,
      history: history ?? [],
      total_points: totalPoints,
      employee_id: auth.employee.id,
    });
  } catch (err) {
    console.error('GET portal entrenamiento-ia history:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
