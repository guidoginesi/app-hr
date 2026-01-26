import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesShell } from '../ObjectivesShell';
import { CorporateObjectivesClient } from './CorporateObjectivesClient';

export const dynamic = 'force-dynamic';

export default async function CorporateObjectivesConfigPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();
  const currentYear = new Date().getFullYear();

  // Get corporate objectives for current and nearby years
  const { data: objectives } = await supabase
    .from('corporate_objectives')
    .select('*')
    .gte('year', currentYear - 2)
    .lte('year', currentYear + 1)
    .order('year', { ascending: false })
    .order('objective_type', { ascending: true });

  return (
    <ObjectivesShell active="config">
      <CorporateObjectivesClient 
        initialObjectives={objectives || []} 
        currentYear={currentYear}
      />
    </ObjectivesShell>
  );
}
