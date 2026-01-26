import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesShell } from '../ObjectivesShell';
import { PeriodsClient } from './PeriodsClient';

export const dynamic = 'force-dynamic';

export default async function PeriodsPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    redirect('/admin/login');
  }

  const supabase = getSupabaseServer();
  const currentYear = new Date().getFullYear();

  // Get all periods
  const { data: periods } = await supabase
    .from('objectives_periods')
    .select('*')
    .order('year', { ascending: false })
    .order('period_type', { ascending: true });

  return (
    <ObjectivesShell active="periods">
      <PeriodsClient 
        initialPeriods={periods || []} 
        currentYear={currentYear}
      />
    </ObjectivesShell>
  );
}
