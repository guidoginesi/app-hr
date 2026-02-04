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
      manager_id,
      department:departments(id, name)
    `)
    .eq('id', employeeId)
    .single();

  if (employeeError || !employee) {
    console.error('Employee not found or error:', { employeeId, employeeError, employee });
    redirect('/admin/objectives');
  }

  // Get manager details separately to avoid self-referential join issues
  let managerName: string | null = null;
  if (employee.manager_id) {
    const { data: manager } = await supabase
      .from('employees')
      .select('first_name, last_name')
      .eq('id', employee.manager_id)
      .single();
    if (manager) {
      managerName = `${manager.first_name} ${manager.last_name}`;
    }
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

  // Get available years for bonus calculation
  let availableBonusYears: number[] = [];
  try {
    const { data: yearsData } = await supabase
      .from('corporate_objectives')
      .select('year')
      .order('year', { ascending: false });
    if (yearsData) {
      availableBonusYears = [...new Set(yearsData.map(d => d.year))];
    }
  } catch {
    // Table might not exist
  }

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
          manager_name: managerName,
        }}
        corporateObjectives={corporateObjectives || []}
        areaObjectives={areaObjectives || []}
        weights={weights}
        seniorityLevel={seniorityLevel}
        seniorityCategory={seniorityCategory}
        currentYear={currentYear}
        availableBonusYears={availableBonusYears}
      />
    </ObjectivesShell>
  );
}
