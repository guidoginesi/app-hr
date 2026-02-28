import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesShell } from './ObjectivesShell';
import { ObjectivesDashboardClient } from './ObjectivesDashboardClient';

export const dynamic = 'force-dynamic';

export default async function ObjectivesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();
  const { year: yearParam } = await searchParams;

  // Default to previous year (same logic as bonos page)
  const { data: yearRows } = await supabase
    .from('corporate_objectives')
    .select('year')
    .order('year', { ascending: false });
  const availableYears = yearRows ? [...new Set(yearRows.map((r: any) => r.year as number))] : [];
  const prevYear = new Date().getFullYear() - 1;
  const defaultYear = availableYears.includes(prevYear) ? prevYear : (availableYears[0] ?? prevYear);
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  // Get corporate objectives for the selected year
  const { data: corporateObjectives } = await supabase
    .from('corporate_objectives')
    .select('*')
    .eq('year', selectedYear);

  // Check billing and NPS configuration
  const hasBilling = corporateObjectives?.some(o => o.objective_type === 'billing') || false;
  const npsCount = corporateObjectives?.filter(o => o.objective_type === 'nps').length || 0;
  const hasCorporateObjectives = hasBilling && npsCount >= 1; // At least billing + 1 NPS quarter

  // Get all active employees with their objectives for the selected year
  // We fetch all objectives (main + sub) so we can calculate real progress for semestral/trimestral
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
        periodicity,
        progress_percentage,
        achievement_percentage,
        is_locked,
        status,
        parent_objective_id
      )
    `)
    .eq('status', 'active')
    .order('last_name', { ascending: true });

  // Process employees data
  const processedEmployees = (employees || []).map((emp: any) => {
    const allYearObjs = (emp.objectives || []).filter((obj: any) => obj.year === selectedYear);

    // Main objectives only (parent_objective_id is null)
    const mainObjectives = allYearObjs.filter(
      (obj: any) => obj.parent_objective_id == null
    );
    const areaObjectivesCount = mainObjectives.length;

    // Calculate real progress:
    // - For annual objectives: use progress_percentage directly
    // - For semestral/trimestral: average sub-objectives' progress_percentage
    let totalProgress: number | null = null;
    if (areaObjectivesCount > 0) {
      const subObjectivesByParent = allYearObjs
        .filter((obj: any) => obj.parent_objective_id != null)
        .reduce((acc: Record<string, any[]>, sub: any) => {
          if (!acc[sub.parent_objective_id]) acc[sub.parent_objective_id] = [];
          acc[sub.parent_objective_id].push(sub);
          return acc;
        }, {} as Record<string, any[]>);

      // Helper: pick the best value for a single objective row
      // If evaluated (achievement_percentage set or is_locked), use achievement; otherwise use progress
      const effectiveValue = (obj: any): number => {
        if (obj.is_locked || obj.achievement_percentage != null) {
          return Math.min(obj.achievement_percentage ?? 0, 100);
        }
        return obj.progress_percentage || 0;
      };

      const progressValues = mainObjectives.map((obj: any) => {
        const subs: any[] = subObjectivesByParent[obj.id] || [];
        if (obj.periodicity !== 'annual' && subs.length > 0) {
          return Math.round(
            subs.reduce((sum: number, s: any) => sum + effectiveValue(s), 0) / subs.length
          );
        }
        return effectiveValue(obj);
      });

      totalProgress = Math.round(progressValues.reduce((a: number, b: number) => a + b, 0) / progressValues.length);
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
      e.area_objectives_count === 0
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
        currentYear={selectedYear}
      />
    </ObjectivesShell>
  );
}
