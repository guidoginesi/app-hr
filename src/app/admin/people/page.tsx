import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PeopleShell } from './PeopleShell';
import { PeopleClient } from './PeopleClient';

export const dynamic = 'force-dynamic';

export default async function AdminPeoplePage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Fetch employees with related data using view (has correct manager info)
  const { data: employeesRaw } = await supabase
    .from('employees_with_details')
    .select('*')
    .order('last_name', { ascending: true });

  // Transform to expected format with manager object
  const employees = (employeesRaw || []).map((emp: any) => ({
    ...emp,
    legal_entity: emp.legal_entity_id ? { id: emp.legal_entity_id, name: emp.legal_entity_name } : null,
    department: emp.department_id ? { id: emp.department_id, name: emp.department_name } : null,
    manager: emp.manager_employee_id ? { 
      id: emp.manager_employee_id, 
      first_name: emp.manager_first_name || '', 
      last_name: emp.manager_last_name || '' 
    } : null,
  }));

  // Fetch legal entities for filters and forms
  const { data: legalEntities } = await supabase
    .from('legal_entities')
    .select('*')
    .eq('is_active', true)
    .order('name');

  // Fetch departments for filters and forms
  const { data: departments } = await supabase
    .from('departments')
    .select(`
      *,
      legal_entity:legal_entities(id, name)
    `)
    .eq('is_active', true)
    .order('name');

  return (
    <PeopleShell active="empleados">
      <PeopleClient
        employees={employees || []}
        legalEntities={legalEntities || []}
        departments={departments || []}
      />
    </PeopleShell>
  );
}
