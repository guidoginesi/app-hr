import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { calculateDimensionScore, calculateTotalScore, calculateObjectivesAverage, calculateGap } from '@/types/evaluation';

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/portal/evaluations/[id]/submit - Submit evaluation
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get evaluation with all data
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('*')
      .eq('id', id)
      .single();

    if (!evaluation || evaluation.evaluator_id !== auth.employee.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta evaluación' }, { status: 403 });
    }

    if (evaluation.status === 'submitted') {
      return NextResponse.json({ error: 'La evaluación ya fue enviada' }, { status: 400 });
    }

    // Get dimensions and items
    const { data: dimensions } = await supabase
      .from('evaluation_dimensions')
      .select(`*, items:evaluation_items(*)`)
      .eq('period_id', evaluation.period_id)
      .eq('is_active', true);

    // Get responses
    const { data: responses } = await supabase
      .from('evaluation_responses')
      .select('*')
      .eq('evaluation_id', id);

    // Calculate dimension scores
    const dimensionScores: Record<string, number> = {};
    dimensions?.forEach(dim => {
      const items = dim.items?.filter((i: any) => i.is_active) || [];
      const score = calculateDimensionScore(responses || [], items);
      if (score !== null) {
        dimensionScores[dim.id] = score;
      }
    });

    // Calculate total score
    const totalScore = calculateTotalScore(dimensionScores);

    // For leader evaluations, handle recategorization
    if (evaluation.type === 'leader') {
      // Get objectives
      const { data: objectives } = await supabase
        .from('evaluation_objectives')
        .select('*')
        .eq('evaluation_id', id);

      const objectivesAverage = calculateObjectivesAverage(objectives || []);

      // Get self-evaluation score
      const { data: selfEval } = await supabase
        .from('evaluations')
        .select('total_score')
        .eq('period_id', evaluation.period_id)
        .eq('employee_id', evaluation.employee_id)
        .eq('type', 'self')
        .eq('status', 'submitted')
        .single();

      const gap = calculateGap(selfEval?.total_score, totalScore);

      // Update or create recategorization
      const body = await req.json().catch(() => ({}));
      
      await supabase
        .from('evaluation_recategorization')
        .upsert({
          evaluation_id: id,
          self_score: selfEval?.total_score,
          leader_score: totalScore,
          gap,
          objectives_average: objectivesAverage,
          level_recategorization: body.level_recategorization || null,
          position_recategorization: body.position_recategorization || null,
          notes: body.notes || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'evaluation_id' });
    }

    // Update evaluation
    const { data: updated, error } = await supabase
      .from('evaluations')
      .update({
        status: 'submitted',
        total_score: totalScore,
        dimension_scores: dimensionScores,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error submitting evaluation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in POST /api/portal/evaluations/[id]/submit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
