import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from './EvaluationsShell';
import { EvaluationsDashboardClient } from './EvaluationsDashboardClient';

export const dynamic = 'force-dynamic';

export default async function EvaluationsDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get all periods, evaluations with employee data, and calculate item scores
  const [periodsResult, evaluationsResult, activePeriodResult] = await Promise.all([
    supabase
      .from('evaluation_periods')
      .select('*')
      .order('year', { ascending: false }),
    supabase
      .from('evaluations')
      .select(`
        id,
        period_id,
        employee_id,
        type,
        status,
        total_score,
        employee:employees!evaluations_employee_id_fkey(
          id,
          first_name,
          last_name,
          department:departments(id, name)
        )
      `)
      .eq('status', 'submitted'),
    supabase
      .from('evaluation_periods')
      .select('id')
      .eq('status', 'open')
      .single(),
  ]);

  const periods = periodsResult.data || [];
  const activePeriodId = activePeriodResult.data?.id || null;

  // Transform evaluations data - flatten arrays from Supabase joins
  const evaluations = (evaluationsResult.data || []).map((e: any) => {
    const emp = Array.isArray(e.employee) ? e.employee[0] : e.employee;
    return {
      ...e,
      employee: emp ? {
        ...emp,
        department: Array.isArray(emp.department) 
          ? emp.department[0] || null 
          : emp.department,
      } : null,
    };
  }) as any[];

  // Get item scores aggregated from leader evaluations
  const { data: itemScoresRaw } = await supabase
    .from('evaluation_responses')
    .select(`
      item_id,
      score,
      evaluation:evaluations!inner(
        type,
        status,
        period_id
      ),
      item:evaluation_items!inner(
        statement,
        dimension:evaluation_dimensions!inner(name)
      )
    `)
    .eq('evaluation.type', 'leader')
    .eq('evaluation.status', 'submitted')
    .not('score', 'is', null);

  // Aggregate item scores — keyed by item_id + period_id so we can filter by period in the client
  const itemScoresMap = new Map<string, {
    item_id: string;
    period_id: string;
    statement: string;
    dimension_name: string;
    scores: number[];
  }>();

  (itemScoresRaw || []).forEach((r: any) => {
    if (!r.item || !r.score) return;
    const evaluation = Array.isArray(r.evaluation) ? r.evaluation[0] : r.evaluation;
    const periodId = evaluation?.period_id || 'unknown';
    const key = `${r.item_id}:${periodId}`;
    if (!itemScoresMap.has(key)) {
      itemScoresMap.set(key, {
        item_id: r.item_id,
        period_id: periodId,
        statement: r.item.statement,
        dimension_name: r.item.dimension?.name || 'Sin dimensión',
        scores: [],
      });
    }
    itemScoresMap.get(key)!.scores.push(r.score);
  });

  const itemScores = Array.from(itemScoresMap.values()).map(item => ({
    item_id: item.item_id,
    period_id: item.period_id,
    statement: item.statement,
    dimension_name: item.dimension_name,
    avg_score: item.scores.reduce((a, b) => a + b, 0) / item.scores.length,
    response_count: item.scores.length,
  }));

  return (
    <EvaluationsShell active="dashboard">
      <EvaluationsDashboardClient
        periods={periods}
        evaluations={evaluations}
        itemScores={itemScores}
        activePeriodId={activePeriodId}
      />
    </EvaluationsShell>
  );
}
