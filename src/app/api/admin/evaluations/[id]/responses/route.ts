import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/checkAdmin';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/evaluations/[id]/responses - Fetch all responses for an evaluation
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Verify the evaluation exists
    const { data: evaluation, error: evalError } = await supabase
      .from('evaluations')
      .select('id, type, status, total_score, dimension_scores')
      .eq('id', id)
      .single();

    if (evalError || !evaluation) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // Fetch scored responses with item + dimension info
    const { data: responses, error: responsesError } = await supabase
      .from('evaluation_responses')
      .select(`
        id,
        score,
        explanation,
        item:evaluation_items!inner(
          id,
          statement,
          dimension:evaluation_dimensions!inner(id, name)
        )
      `)
      .eq('evaluation_id', id)
      .not('score', 'is', null)
      .order('id');

    if (responsesError) {
      return NextResponse.json({ error: responsesError.message }, { status: 500 });
    }

    // Fetch open question responses
    const { data: openQuestions } = await supabase
      .from('evaluation_open_questions')
      .select('id, question_key, response')
      .eq('evaluation_id', id)
      .not('response', 'is', null);

    // Flatten nested arrays from PostgREST joins
    const normalizedResponses = (responses || []).map((r: any) => {
      const item = Array.isArray(r.item) ? r.item[0] : r.item;
      const dimension = item ? (Array.isArray(item.dimension) ? item.dimension[0] : item.dimension) : null;
      return {
        id: r.id,
        score: r.score,
        explanation: r.explanation,
        item_id: item?.id,
        statement: item?.statement || '',
        dimension_id: dimension?.id,
        dimension_name: dimension?.name || 'Sin dimensión',
      };
    });

    return NextResponse.json({
      evaluation,
      responses: normalizedResponses,
      openQuestions: openQuestions || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
