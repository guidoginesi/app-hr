import { redirect } from 'next/navigation';
import { getAuthResult, checkIsLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../../PortalShell';
import { ResultadosClient } from './ResultadosClient';

export const dynamic = 'force-dynamic';

export default async function ResultadosPage() {
  const auth = await getAuthResult();
  
  if (!auth.user || !auth.employee) {
    redirect('/portal/login');
  }

  const supabase = getSupabaseServer();
  const employeeId = auth.employee.id;
  const isLeader = auth.isLeader || await checkIsLeader(employeeId);

  // Get active or most recent period
  const { data: period } = await supabase
    .from('evaluation_periods')
    .select('*')
    .or('status.eq.open,status.eq.closed')
    .order('year', { ascending: false })
    .limit(1)
    .single();

  if (!period) {
    return (
      <PortalShell employee={auth.employee} isLeader={isLeader} active="evaluaciones">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-500">No hay resultados de evaluación disponibles.</p>
        </div>
      </PortalShell>
    );
  }

  // Get self-evaluation
  const { data: selfEvaluation } = await supabase
    .from('evaluations')
    .select('*')
    .eq('period_id', period.id)
    .eq('employee_id', employeeId)
    .eq('evaluator_id', employeeId)
    .eq('type', 'self')
    .single();

  // Get leader evaluation for this employee
  const { data: leaderEvaluation } = await supabase
    .from('evaluations')
    .select(`
      *,
      evaluator:employees!evaluator_id(id, first_name, last_name)
    `)
    .eq('period_id', period.id)
    .eq('employee_id', employeeId)
    .eq('type', 'leader')
    .single();

  // Get dimensions
  const { data: dimensions } = await supabase
    .from('evaluation_dimensions')
    .select('*')
    .eq('period_id', period.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true });

  // Check if period allows showing results
  const canShowResults = period.show_results_to_employee;

  return (
    <PortalShell employee={auth.employee} isLeader={isLeader} active="evaluaciones">
      <ResultadosClient
        period={period}
        selfEvaluation={selfEvaluation}
        leaderEvaluation={leaderEvaluation}
        dimensions={dimensions || []}
        canShowResults={canShowResults}
      />
    </PortalShell>
  );
}
