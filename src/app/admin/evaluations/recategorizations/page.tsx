import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../EvaluationsShell';
import { RecategorizationsClient } from './RecategorizationsClient';

export const dynamic = 'force-dynamic';

export default async function RecategorizationsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin');
  }

  const supabase = getSupabaseServer();

  // Get all recategorizations with employee and evaluation data
  const { data: recategorizations, error } = await supabase
    .from('evaluation_recategorization')
    .select(`
      *,
      evaluation:evaluations!evaluation_id(
        id,
        period_id,
        employee_id,
        evaluator_id,
        type,
        status,
        total_score,
        employee:employees!employee_id(
          id,
          first_name,
          last_name,
          job_title,
          seniority_level,
          department:departments(id, name)
        ),
        evaluator:employees!evaluator_id(
          id,
          first_name,
          last_name
        ),
        period:evaluation_periods!period_id(
          id,
          name,
          year
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recategorizations:', error);
  }

  // Get active period for filtering
  const { data: periods } = await supabase
    .from('evaluation_periods')
    .select('id, name, year')
    .order('year', { ascending: false });

  return (
    <EvaluationsShell active="recategorizations">
      <RecategorizationsClient 
        recategorizations={recategorizations || []} 
        periods={periods || []}
      />
    </EvaluationsShell>
  );
}
