import { redirect } from 'next/navigation';
import { getAuthResult, checkIsLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { EvaluacionesClient } from './EvaluacionesClient';

export const dynamic = 'force-dynamic';

export default async function PortalEvaluacionesPage() {
  const auth = await getAuthResult();
  
  if (!auth.user) {
    redirect('/portal/login');
  }

  if (!auth.employee) {
    redirect('/portal');
  }

  const supabase = getSupabaseServer();
  const employeeId = auth.employee.id;

  // Check if user is a leader
  const isLeader = auth.isLeader || await checkIsLeader(employeeId);

  // Get active period
  const { data: activePeriod } = await supabase
    .from('evaluation_periods')
    .select('*')
    .eq('status', 'open')
    .eq('is_active', true)
    .single();

  // Get self-evaluation for current period
  let selfEvaluation = null;
  if (activePeriod) {
    const { data } = await supabase
      .from('evaluations')
      .select('*')
      .eq('period_id', activePeriod.id)
      .eq('employee_id', employeeId)
      .eq('evaluator_id', employeeId)
      .eq('type', 'self')
      .single();
    selfEvaluation = data;
  }

  // Get leader evaluations and pending team members
  let leaderEvaluations: any[] = [];
  let pendingTeamEvaluations: any[] = [];
  
  if (isLeader && activePeriod) {
    // Get existing leader evaluations
    const { data: leaderEvals } = await supabase
      .from('evaluations')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .eq('period_id', activePeriod.id)
      .eq('evaluator_id', employeeId)
      .eq('type', 'leader');
    leaderEvaluations = leaderEvals || [];

    // Get direct reports
    const { data: directReports } = await supabase
      .from('employees')
      .select('id, first_name, last_name, job_title')
      .eq('manager_id', employeeId)
      .eq('status', 'active');

    if (directReports && directReports.length > 0) {
      const evaluatedIds = leaderEvaluations.map(e => e.employee_id);
      pendingTeamEvaluations = directReports.filter(dr => !evaluatedIds.includes(dr.id));
    }
  }

  return (
    <PortalShell employee={auth.employee} isLeader={isLeader} active="evaluaciones">
      <EvaluacionesClient
        employee={auth.employee}
        isLeader={isLeader}
        activePeriod={activePeriod}
        selfEvaluation={selfEvaluation}
        leaderEvaluations={leaderEvaluations}
        pendingTeamEvaluations={pendingTeamEvaluations}
      />
    </PortalShell>
  );
}
