import { redirect } from 'next/navigation';
import { getAuthResult } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { LeaderEvaluationWizard } from './LeaderEvaluationWizard';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeaderEvaluationPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await getAuthResult();
  
  if (!auth.user || !auth.employee) {
    redirect('/portal/login');
  }

  const supabase = getSupabaseServer();

  // Get evaluation with all data
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
    redirect('/portal/evaluaciones');
  }

  // Verify ownership
  if (evaluation.evaluator_id !== auth.employee.id) {
    redirect('/portal/evaluaciones');
  }

  // Must be a leader evaluation
  if (evaluation.type !== 'leader') {
    redirect('/portal/evaluaciones');
  }

  // Already submitted
  if (evaluation.status === 'submitted') {
    redirect('/portal/evaluaciones');
  }

  // Get dimensions with items
  const { data: dimensions } = await supabase
    .from('evaluation_dimensions')
    .select(`
      *,
      items:evaluation_items(*)
    `)
    .eq('period_id', evaluation.period_id)
    .eq('is_active', true)
    .order('order_index', { ascending: true });

  const sortedDimensions = dimensions?.map(dim => ({
    ...dim,
    items: dim.items?.filter((i: any) => i.is_active).sort((a: any, b: any) => a.order_index - b.order_index)
  })) || [];

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

  // Get objectives
  const { data: objectives } = await supabase
    .from('evaluation_objectives')
    .select('*')
    .eq('evaluation_id', id)
    .order('quarter', { ascending: true });

  // Get recategorization
  const { data: recategorization } = await supabase
    .from('evaluation_recategorization')
    .select('*')
    .eq('evaluation_id', id)
    .single();

  // Get self-evaluation summary
  const { data: selfEvaluation } = await supabase
    .from('evaluations')
    .select('id, total_score, dimension_scores, status')
    .eq('period_id', evaluation.period_id)
    .eq('employee_id', evaluation.employee_id)
    .eq('type', 'self')
    .single();

  // Get open question configuration
  const { data: openQuestionConfig } = await supabase
    .from('evaluation_open_question_config')
    .select('question_key, label_self, label_leader, description')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  return (
    <LeaderEvaluationWizard
      evaluation={evaluation}
      dimensions={sortedDimensions}
      initialResponses={responses || []}
      initialOpenQuestions={openQuestions || []}
      initialObjectives={objectives || []}
      initialRecategorization={recategorization}
      selfEvaluationSummary={selfEvaluation}
      openQuestionConfig={openQuestionConfig || []}
      evaluator={auth.employee}
    />
  );
}
