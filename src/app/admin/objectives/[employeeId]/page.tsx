import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesShell } from '../ObjectivesShell';
import { EmployeeObjectivesDetailClient } from './EmployeeObjectivesDetailClient';
import { getWeightsForLevel, getSeniorityCategory, SeniorityCategory } from '@/types/corporate-objectives';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ year?: string }>;
};

export default async function EmployeeObjectivesDetailPage({ params, searchParams }: PageProps) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const { employeeId } = await params;
  const searchParamsResolved = await searchParams;
  const currentYear = searchParamsResolved.year 
    ? parseInt(searchParamsResolved.year) 
    : new Date().getFullYear();

  const supabase = getSupabaseServer();

  // Get employee details
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select(`
      id,
      first_name,
      last_name,
      seniority_level,
      job_title,
      department:departments(id, name),
      manager:employees!employees_manager_id_fkey(id, first_name, last_name)
    `)
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) {
    redirect('/admin/objectives');
  }

  // Get corporate objectives for the year
  const { data: corporateObjectives } = await supabase
    .from('corporate_objectives')
    .select('*')
    .eq('year', currentYear)
    .order('objective_type');

  // Get area objectives for this employee
  const { data: areaObjectives } = await supabase
    .from('objectives')
    .select(`
      *,
      created_by_employee:employees!objectives_created_by_fkey(id, first_name, last_name)
    `)
    .eq('employee_id', employeeId)
    .eq('year', currentYear)
    .order('objective_number', { ascending: true });

  // Calculate weights based on seniority
  const seniorityLevel = employee.seniority_level as string | null;
  const seniorityCategory = getSeniorityCategory(seniorityLevel) || 1;
  const weights = getWeightsForLevel(seniorityLevel);

  return (
    <ObjectivesShell active="employee">
      <EmployeeObjectivesDetailClient
        employee={{
          ...employee,
          department_name: (employee.department as any)?.[0]?.name || (employee.department as any)?.name || null,
          manager_name: (employee.manager as any)
            ? `${(employee.manager as any).first_name || (employee.manager as any)[0]?.first_name} ${(employee.manager as any).last_name || (employee.manager as any)[0]?.last_name}`
            : null,
        }}
        corporateObjectives={corporateObjectives || []}
        areaObjectives={areaObjectives || []}
        weights={weights}
        seniorityLevel={seniorityLevel}
        seniorityCategory={seniorityCategory}
        currentYear={currentYear}
      />
    </ObjectivesShell>
  );
}
