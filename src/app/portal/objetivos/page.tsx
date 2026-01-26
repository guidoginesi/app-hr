import { redirect } from 'next/navigation';
import { getAuthResult, checkIsLeader } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PortalShell } from '../PortalShell';
import { ObjetivosClient } from './ObjetivosClient';
import { ObjectivesPeriod } from '@/types/objective';

export const dynamic = 'force-dynamic';

export default async function PortalObjetivosPage() {
  const auth = await getAuthResult();
  
  if (!auth.user) {
    redirect('/portal/login');
  }

  if (!auth.employee) {
    redirect('/portal');
  }

  const supabase = getSupabaseServer();
  const employeeId = auth.employee.id;
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];

  // Get periods for current year (table might not exist yet)
  let periods: ObjectivesPeriod[] = [];
  try {
    const { data: periodsData, error } = await supabase
      .from('objectives_periods')
      .select('*')
      .eq('is_active', true)
      .gte('year', currentYear - 1)
      .lte('year', currentYear + 1)
      .order('year', { ascending: false });
    
    if (!error && periodsData) {
      periods = periodsData as ObjectivesPeriod[];
    }
  } catch {
    // Table might not exist yet, use empty array
    periods = [];
  }

  // Check if user is a leader
  const isLeader = auth.isLeader || await checkIsLeader(employeeId);

  // Get direct reports if leader
  let directReports: any[] = [];
  if (isLeader) {
    const { data } = await supabase
      .from('employees')
      .select('id, first_name, last_name, job_title')
      .eq('manager_id', employeeId)
      .eq('status', 'active')
      .order('last_name');
    directReports = data || [];
  }

  // Get own objectives
  const { data: ownObjectives } = await supabase
    .from('objectives')
    .select('*')
    .eq('employee_id', employeeId)
    .order('year', { ascending: false })
    .order('period_type');

  // Get team objectives if leader
  let teamObjectives: any[] = [];
  if (isLeader && directReports.length > 0) {
    const directReportIds = directReports.map(e => e.id);
    const { data } = await supabase
      .from('objectives')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .in('employee_id', directReportIds)
      .order('year', { ascending: false })
      .order('period_type');
    teamObjectives = data || [];
  }

  return (
    <PortalShell employee={auth.employee} isLeader={isLeader} active="objetivos">
      <ObjetivosClient
        employee={auth.employee}
        isLeader={isLeader}
        directReports={directReports}
        ownObjectives={ownObjectives || []}
        teamObjectives={teamObjectives}
        periods={periods}
        today={today}
      />
    </PortalShell>
  );
}
