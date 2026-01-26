import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PeopleShell } from '../PeopleShell';
import { OrgChart } from './OrgChart';

export const dynamic = 'force-dynamic';

export default async function OrganigramaPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Fetch all active employees with their manager relationships
  const { data: rawEmployees } = await supabase
    .from('employees')
    .select(`
      id,
      first_name,
      last_name,
      job_title,
      photo_url,
      manager_id,
      department:departments(id, name),
      legal_entity:legal_entities(id, name)
    `)
    .eq('status', 'active')
    .order('last_name', { ascending: true });

  // Transform data: Supabase returns arrays for joins, but we need single objects
  const employees = (rawEmployees || []).map(emp => ({
    id: emp.id as string,
    first_name: emp.first_name as string,
    last_name: emp.last_name as string,
    job_title: emp.job_title as string | null,
    photo_url: emp.photo_url as string | null,
    manager_id: emp.manager_id as string | null,
    department: Array.isArray(emp.department) 
      ? (emp.department[0] as { id: string; name: string } | undefined) || null 
      : emp.department as { id: string; name: string } | null,
    legal_entity: Array.isArray(emp.legal_entity) 
      ? (emp.legal_entity[0] as { id: string; name: string } | undefined) || null 
      : emp.legal_entity as { id: string; name: string } | null,
  }));

  return (
    <PeopleShell active="organigrama">
      <OrgChart employees={employees} />
    </PeopleShell>
  );
}
