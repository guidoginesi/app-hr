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
  const { data: employees } = await supabase
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

  return (
    <PeopleShell active="organigrama">
      <OrgChart employees={employees || []} />
    </PeopleShell>
  );
}
