import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesShell } from './ObjectivesShell';
import { ObjectivesDashboardClient } from './ObjectivesDashboardClient';

export const dynamic = 'force-dynamic';

export default async function ObjectivesDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();
  const currentYear = new Date().getFullYear();

  // Get corporate objectives for current year
  const { data: corporateObjectives } = await supabase
    .from('corporate_objectives')
    .select('*')
    .eq('year', currentYear);

  // Check billing and NPS configuration
  const hasBilling = corporateObjectives?.some(o => o.objective_type === 'billing') || false;
  const npsCount = corporateObjectives?.filter(o => o.objective_type === 'nps').length || 0;
  const hasCorporateObjectives = hasBilling && npsCount >= 1; // At least billing + 1 NPS quarter

  // Get all active employees with their objectives
  const { data: employees } = await supabase
    .from('employees')
    .select(`
      id,
      first_name,
      last_name,
      seniority_level,
      department:departments(id, name),
      objectives!objectives_employee_id_fkey(
        id,
        year,
        progress_percentage,
        status
      )
    `)
    .eq('status', 'active')
    .order('last_name', { ascending: true });

  // Process employees data
  const processedEmployees = (employees || []).map((emp: any) => {
    const yearObjectives = (emp.objectives || []).filter((obj: any) => obj.year === currentYear);
    const areaObjectivesCount = yearObjectives.length;
    
    // Calculate progress
    let totalProgress: number | null = null;
    if (areaObjectivesCount > 0) {
      const areaProgress = yearObjectives.reduce((sum: number, obj: any) => sum + (obj.progress_percentage || 0), 0);
      totalProgress = Math.round(areaProgress / areaObjectivesCount);
    }

    return {
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      department_name: emp.department?.name || null,
      seniority_level: emp.seniority_level,
      has_billing: hasBilling,
      nps_count: npsCount,
      area_objectives_count: areaObjectivesCount,
      total_progress: totalProgress,
      has_all_objectives: areaObjectivesCount >= 2 && hasCorporateObjectives,
    };
  });

  // Calculate stats
  const stats = {
    total_employees: processedEmployees.length,
    with_complete_objectives: processedEmployees.filter((e: any) => e.has_all_objectives).length,
    with_partial_objectives: processedEmployees.filter((e: any) => 
      !e.has_all_objectives && (e.area_objectives_count > 0 || hasBilling || npsCount > 0)
    ).length,
    without_objectives: processedEmployees.filter((e: any) => 
      e.area_objectives_count === 0 && !hasBilling && npsCount === 0
    ).length,
    has_billing: hasBilling,
    nps_count: npsCount,
    corporate_objectives_configured: hasCorporateObjectives,
  };

  // Get departments for filter
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  return (
    <ObjectivesShell active="dashboard">
      <ObjectivesDashboardClient
        initialEmployees={processedEmployees}
        initialStats={stats}
        departments={departments || []}
        corporateObjectives={corporateObjectives || []}
        currentYear={currentYear}
      />
    </ObjectivesShell>
  );
}
