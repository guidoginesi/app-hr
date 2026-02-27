import { NextRequest, NextResponse } from 'next/server';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/portal/evaluations/[id] - Get evaluation details with dimensions and responses
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseServer();

    // Get evaluation
    const { data: evaluation, error } = await supabase
      .from('evaluations')
      .select(`
        *,
        period:evaluation_periods(*),
        employee:employees!employee_id(id, first_name, last_name, job_title, department:departments(id, name))
      `)
      .eq('id', id)
      .single();

    if (error || !evaluation) {
      return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 });
    }

    // Check permissions: user must be the evaluator, the employee being evaluated, or the direct manager of the employee
    const isEvaluator = evaluation.evaluator_id === auth.employee.id;
    const isEmployee = evaluation.employee_id === auth.employee.id;

    let isManager = false;
    if (!isEvaluator && !isEmployee) {
      const { data: emp } = await supabase
        .from('employees')
        .select('manager_id')
        .eq('id', evaluation.employee_id)
        .single();
      isManager = emp?.manager_id === auth.employee.id;
    }

    if (!isEvaluator && !isEmployee && !isManager) {
      return NextResponse.json({ error: 'No tienes acceso a esta evaluación' }, { status: 403 });
    }

    // Get dimensions with items for this period
    const { data: dimensions } = await supabase
      .from('evaluation_dimensions')
      .select(`
        *,
        items:evaluation_items(*)
      `)
      .eq('period_id', evaluation.period_id)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    // Sort items within each dimension
    const sortedDimensions = dimensions?.map(dim => ({
      ...dim,
      items: dim.items?.filter((i: any) => i.is_active).sort((a: any, b: any) => a.order_index - b.order_index)
    }));

    // Get existing responses
    const { data: responses } = await supabase
      .from('evaluation_responses')
      .select('*')
      .eq('evaluation_id', id);

    // Get open questions
    const { data: openQuestions } = await supabase
      .from('evaluation_open_questions')
      .select('*')
      .eq('evaluation_id', id);

    // Get objectives (for leader evaluations)
    let objectives: any[] = [];
    if (evaluation.type === 'leader') {
      const { data: obj } = await supabase
        .from('evaluation_objectives')
        .select('*')
        .eq('evaluation_id', id)
        .order('quarter', { ascending: true });
      objectives = obj || [];
    }

    // Get recategorization (for leader evaluations)
    let recategorization = null;
    if (evaluation.type === 'leader') {
      const { data: recat } = await supabase
        .from('evaluation_recategorization')
        .select('*')
        .eq('evaluation_id', id)
        .single();
      recategorization = recat;
    }

    // If this is a leader evaluation, also get the self-evaluation results
    let selfEvaluationSummary = null;
    if (evaluation.type === 'leader') {
      const { data: selfEval } = await supabase
        .from('evaluations')
        .select('id, total_score, dimension_scores, status')
        .eq('period_id', evaluation.period_id)
        .eq('employee_id', evaluation.employee_id)
        .eq('type', 'self')
        .single();
      
      selfEvaluationSummary = selfEval;
    }

    return NextResponse.json({
      evaluation,
      dimensions: sortedDimensions || [],
      responses: responses || [],
      openQuestions: openQuestions || [],
      objectives,
      recategorization,
      selfEvaluationSummary,
    });
  } catch (error: any) {
    console.error('Error in GET /api/portal/evaluations/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/portal/evaluations/[id] - Update evaluation (step, status)
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthResult();
    if (!auth.user || !auth.employee) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const supabase = getSupabaseServer();

    // Verify ownership
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('id, evaluator_id, status')
      .eq('id', id)
      .single();

    if (!evaluation || evaluation.evaluator_id !== auth.employee.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta evaluación' }, { status: 403 });
    }

    if (evaluation.status === 'submitted') {
      return NextResponse.json({ error: 'La evaluación ya fue enviada' }, { status: 400 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (body.current_step !== undefined) {
      updateData.current_step = body.current_step;
    }
    
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'in_progress' && evaluation.status === 'draft') {
        updateData.status = 'in_progress';
      }
    }

    const { data: updated, error } = await supabase
      .from('evaluations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error in PUT /api/portal/evaluations/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
