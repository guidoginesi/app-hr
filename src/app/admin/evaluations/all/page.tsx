import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../EvaluationsShell';
import { AllEvaluationsClient } from './AllEvaluationsClient';

export const dynamic = 'force-dynamic';

export default async function AllEvaluationsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get all evaluations with related data
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      period:evaluation_periods(id, name, year),
      employee:employees!employee_id(id, first_name, last_name, job_title, photo_url, department:departments(id, name)),
      evaluator:employees!evaluator_id(id, first_name, last_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  // Get periods for filtering
  const { data: periods } = await supabase
    .from('evaluation_periods')
    .select('id, name, year')
    .order('year', { ascending: false });

  return (
    <EvaluationsShell active="all">
      <AllEvaluationsClient 
        evaluations={evaluations || []} 
        periods={periods || []}
      />
    </EvaluationsShell>
  );
}
