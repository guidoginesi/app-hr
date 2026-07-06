import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/checkAuth';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { ObjectivesLayout } from '../ObjectivesLayout';
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
    <ObjectivesLayout active="periods">
      <PeriodsClient
        initialPeriods={periods || []}
        currentYear={currentYear}
      />
    </ObjectivesLayout>
  );
}
