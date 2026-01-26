import { redirect, notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { EvaluationsShell } from '../../EvaluationsShell';
import { EmployeeEvaluationsClient } from './EmployeeEvaluationsClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeEvaluationsPage({ params }: PageProps) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const { id: employeeId } = await params;
  const supabase = getSupabaseServer();

  // Get employee data
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select(`
      *,
      department:departments(id, name),
      legal_entity:legal_entities(id, name),
      manager:employees!manager_id(id, first_name, last_name)
    `)
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) {
    notFound();
  }

  // Get all evaluations for this employee
  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(`
      *,
      period:evaluation_periods(id, name, year, status),
      evaluator:employees!evaluator_id(id, first_name, last_name)
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  // Get objectives for this employee
  const { data: objectives } = await supabase
    .from('objectives')
    .select('*')
    .eq('employee_id', employeeId)
    .order('year', { ascending: false })
    .order('period_type');

  // Get recategorizations
  const { data: recategorizations } = await supabase
    .from('evaluation_recategorization')
    .select(`
      *,
      evaluation:evaluations!evaluation_id(
        id,
        period:evaluation_periods(id, name, year)
      )
    `)
    .in('evaluation_id', (evaluations || []).map(e => e.id));

  // Get seniority history
  let seniorityHistory: any[] = [];
  try {
    const { data } = await supabase
      .from('seniority_history')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false });
    seniorityHistory = data || [];
  } catch {
    // Table might not exist
  }

  return (
    <EvaluationsShell active="all">
      <EmployeeEvaluationsClient
        employee={employee}
        evaluations={evaluations || []}
        objectives={objectives || []}
        recategorizations={recategorizations || []}
        seniorityHistory={seniorityHistory}
      />
    </EvaluationsShell>
  );
}
