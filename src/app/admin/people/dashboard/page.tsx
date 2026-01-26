import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PeopleShell } from '../PeopleShell';
import { PeopleDashboardClient } from './PeopleDashboardClient';

export const dynamic = 'force-dynamic';

export default async function PeopleDashboardPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Get all employees with their details
  const { data: rawEmployees } = await supabase
    .from('employees')
    .select(`
      id,
      first_name,
      last_name,
      status,
      hire_date,
      termination_date,
      seniority_level,
      department_id,
      legal_entity_id,
      created_at,
      department:departments(id, name),
      legal_entity:legal_entities(id, name)
    `)
    .order('hire_date', { ascending: false });

  // Transform data: Supabase returns arrays for joins
  const employees = (rawEmployees || []).map(emp => ({
    ...emp,
    department: Array.isArray(emp.department) ? emp.department[0] || null : emp.department,
    legal_entity: Array.isArray(emp.legal_entity) ? emp.legal_entity[0] || null : emp.legal_entity,
  }));

  // Get departments
  const { data: departments } = await supabase
    .from('departments')
    .select('id, name')
    .order('name');

  // Get legal entities
  const { data: legalEntities } = await supabase
    .from('legal_entities')
    .select('id, name')
    .order('name');

  return (
    <PeopleShell active="dashboard">
      <PeopleDashboardClient 
        employees={employees || []} 
        departments={departments || []}
        legalEntities={legalEntities || []}
      />
    </PeopleShell>
  );
}
