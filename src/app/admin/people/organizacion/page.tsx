import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { PeopleShell } from '../PeopleShell';
import { OrganizacionClient } from './OrganizacionClient';

export const dynamic = 'force-dynamic';

export default async function OrganizacionPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();

  // Fetch legal entities
  const { data: legalEntities } = await supabase
    .from('legal_entities')
    .select('*')
    .order('name');

  // Fetch departments with legal entity info
  const { data: departments } = await supabase
    .from('departments')
    .select(`
      *,
      legal_entity:legal_entities(id, name)
    `)
    .order('name');

  return (
    <PeopleShell active="organizacion">
      <OrganizacionClient
        initialLegalEntities={legalEntities || []}
        initialDepartments={departments || []}
      />
    </PeopleShell>
  );
}
