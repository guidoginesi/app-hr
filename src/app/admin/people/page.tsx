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

  // Fetch employees with related data
  const { data: employees } = await supabase
    .from('employees')
    .select(`
      *,
      legal_entity:legal_entities(id, name),
      department:departments(id, name),
      manager:employees!manager_id(id, first_name, last_name)
    `)
    .order('last_name', { ascending: true });

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
