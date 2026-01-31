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

  // Get own MAIN objectives (not sub-objectives)
  const { data: ownMainObjectives } = await supabase
    .from('objectives')
    .select('*')
    .eq('employee_id', employeeId)
    .is('parent_objective_id', null)
    .order('year', { ascending: false })
    .order('objective_number', { ascending: true });

  // Fetch sub-objectives for ALL own objectives
  const ownObjectives = await Promise.all(
    (ownMainObjectives || []).map(async (obj) => {
      // Always try to fetch sub-objectives for any objective
      const { data: subObjectives } = await supabase
        .from('objectives')
        .select('*')
        .eq('parent_objective_id', obj.id)
        .order('sub_objective_number', { ascending: true });
      
      const subs = subObjectives || [];
      
      // Use achievement_percentage if evaluated, otherwise progress_percentage
      const calculatedProgress = subs.length > 0
        ? Math.round(subs.reduce((sum, sub) => sum + (sub.achievement_percentage ?? sub.progress_percentage ?? 0), 0) / subs.length)
        : (obj.achievement_percentage ?? obj.progress_percentage);
      
      return { ...obj, sub_objectives: subs, calculated_progress: calculatedProgress };
    })
  );

  // Get team MAIN objectives if leader
  let teamObjectives: any[] = [];
  if (isLeader && directReports.length > 0) {
    const directReportIds = directReports.map(e => e.id);
    const { data: teamMainObjectives } = await supabase
      .from('objectives')
      .select(`
        *,
        employee:employees!employee_id(id, first_name, last_name, job_title)
      `)
      .in('employee_id', directReportIds)
      .is('parent_objective_id', null)
      .order('year', { ascending: false })
      .order('objective_number', { ascending: true });
    
    // Fetch sub-objectives for ALL team objectives (check by querying, not just by periodicity)
    teamObjectives = await Promise.all(
      (teamMainObjectives || []).map(async (obj) => {
        // Always try to fetch sub-objectives for any objective
        const { data: subObjectives } = await supabase
          .from('objectives')
          .select('*')
          .eq('parent_objective_id', obj.id)
          .order('sub_objective_number', { ascending: true });
        
        const subs = subObjectives || [];
        
        // Use achievement_percentage if evaluated, otherwise progress_percentage
        const calculatedProgress = subs.length > 0
          ? Math.round(subs.reduce((sum, sub) => sum + (sub.achievement_percentage ?? sub.progress_percentage ?? 0), 0) / subs.length)
          : (obj.achievement_percentage ?? obj.progress_percentage);
        
        return { ...obj, sub_objectives: subs, calculated_progress: calculatedProgress };
      })
    );
  }

  // Get available years from corporate objectives (years that admins have configured)
  let availableYears: number[] = [];
  try {
    const { data } = await supabase
      .from('corporate_objectives')
      .select('year')
      .order('year', { ascending: false });
    
    if (data) {
      // Get unique years
      availableYears = [...new Set(data.map(d => d.year))];
    }
  } catch {
    // Table might not exist
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
        availableYears={availableYears}
      />
    </PortalShell>
  );
}
